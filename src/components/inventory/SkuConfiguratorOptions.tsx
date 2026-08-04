"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, Trash2, Search, GripVertical } from "lucide-react"
import { createClient } from "@/lib/supabase"

type OptionCategory = {
  id: string
  generic_sku_id: string
  category_name: string
  category_type: "component" | "spec"
  sort_order: number
  is_required: boolean
  choices?: OptionChoice[]
}

type OptionChoice = {
  id: string
  option_category_id: string
  component_sku_id: string | null
  spec_value: string | null
  display_label: string
  sort_order: number
}

type ComponentSku = {
  id: string
  sku_code: string
  name: string
  sku_type: string
}

type SkuConfiguratorOptionsProps = {
  genericSkuId: string
}

const inputStyle = { background: "#23282E", border: "0.5px solid rgba(255,255,255,0.12)", color: "#fff", padding: "8px 10px", fontSize: "12px", fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box" as const }
const labelStyle = { display: "block" as const, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#8B919A", marginBottom: "4px" }

export default function SkuConfiguratorOptions({ genericSkuId }: SkuConfiguratorOptionsProps) {
  const [categories, setCategories] = useState<OptionCategory[]>([])
  const [componentSkus, setComponentSkus] = useState<ComponentSku[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryType, setNewCategoryType] = useState<"component" | "spec">("component")
  const [choicePicker, setChoicePicker] = useState<string | null>(null)
  const [choiceSearch, setChoiceSearch] = useState("")
  const [newSpecValue, setNewSpecValue] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [genericSkuId])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: catData }, { data: compData }] = await Promise.all([
      supabase.from("sku_option_categories").select("*").eq("generic_sku_id", genericSkuId).order("sort_order"),
      supabase.from("skus").select("id, sku_code, name, sku_type").eq("is_active", true).in("sku_type", ["component", "consumable"]).order("sku_code"),
    ])

    if (compData) setComponentSkus(compData)

    if (catData && catData.length > 0) {
      const catIds = catData.map((c: any) => c.id)
      const { data: choicesData } = await supabase
        .from("sku_option_choices")
        .select("*, component:skus(sku_code, name)")
        .in("option_category_id", catIds)
        .order("sort_order")

      const merged = catData.map((cat: any) => ({
        ...cat,
        choices: (choicesData || []).filter((c: any) => c.option_category_id === cat.id),
      }))
      setCategories(merged)
    } else {
      setCategories([])
    }
    setLoading(false)
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from("sku_option_categories").insert({
      generic_sku_id: genericSkuId,
      category_name: newCategoryName.trim(),
      category_type: newCategoryType,
      sort_order: categories.length,
    })
    setNewCategoryName("")
    setSaving(false)
    loadAll()
  }

  async function deleteCategory(categoryId: string) {
    const supabase = createClient()
    await supabase.from("sku_option_categories").delete().eq("id", categoryId)
    loadAll()
  }

  async function addComponentChoice(categoryId: string, component: ComponentSku) {
    const supabase = createClient()
    const category = categories.find(c => c.id === categoryId)
    const existing = category?.choices?.some(c => c.component_sku_id === component.id)
    if (existing) return
    await supabase.from("sku_option_choices").insert({
      option_category_id: categoryId,
      component_sku_id: component.id,
      display_label: component.name,
      sort_order: category?.choices?.length || 0,
    })
    loadAll()
  }

  async function addSpecChoice(categoryId: string) {
    if (!newSpecValue.trim()) return
    const supabase = createClient()
    const category = categories.find(c => c.id === categoryId)
    await supabase.from("sku_option_choices").insert({
      option_category_id: categoryId,
      spec_value: newSpecValue.trim(),
      display_label: newSpecValue.trim(),
      sort_order: category?.choices?.length || 0,
    })
    setNewSpecValue("")
    loadAll()
  }

  async function removeChoice(choiceId: string) {
    const supabase = createClient()
    await supabase.from("sku_option_choices").delete().eq("id", choiceId)
    loadAll()
  }

  const filteredComponents = componentSkus.filter(c =>
    !choiceSearch || c.sku_code.toLowerCase().includes(choiceSearch.toLowerCase()) || c.name.toLowerCase().includes(choiceSearch.toLowerCase())
  )

  if (loading) {
    return <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif" }}>Loading configurator options...</p>
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Existing categories */}
      {categories.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#666C75", fontFamily: "'Barlow', sans-serif", fontStyle: "italic", margin: 0 }}>
          No configurator options defined yet. Add categories below (e.g. Shaft, Grip, Ferrule).
        </p>
      ) : categories.map(cat => {
        const isExpanded = expandedCategory === cat.id
        const isPickingChoice = choicePicker === cat.id

        return (
          <div key={cat.id} style={{ background: "#23282E", border: "0.5px solid rgba(255,255,255,0.10)" }}>
            <div onClick={() => setExpandedCategory(isExpanded ? null : cat.id)} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, color: "#E0E2E6", flex: 1 }}>{cat.category_name}</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: cat.category_type === "component" ? "#6A9CC8" : "#C4A93A", background: cat.category_type === "component" ? "rgba(106,156,200,0.12)" : "rgba(196,169,58,0.1)", padding: "2px 7px" }}>
                {cat.category_type === "component" ? "Component" : "Spec"}
              </span>
              <span style={{ fontSize: "11px", color: "#787E87", fontFamily: "'Barlow', sans-serif" }}>{cat.choices?.length || 0} choice{cat.choices?.length !== 1 ? "s" : ""}</span>
              <button onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }} style={{ background: "none", border: "none", color: "#666C75", cursor: "pointer", padding: "2px" }}><Trash2 size={13} /></button>
              <ChevronDown size={14} color="#787E87" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }} />
            </div>

            {isExpanded && (
              <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "12px 14px" }}>

                {/* Existing choices */}
                {(cat.choices || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
                    {(cat.choices || []).map(choice => (
                      <div key={choice.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#2B3038", padding: "6px 10px" }}>
                        <span style={{ fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif" }}>
                          {cat.category_type === "component" && (choice as any).component?.sku_code && (
                            <span style={{ color: "#A91E22", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginRight: "6px" }}>{(choice as any).component.sku_code}</span>
                          )}
                          {choice.display_label}
                        </span>
                        <button onClick={() => removeChoice(choice.id)} style={{ background: "none", border: "none", color: "#666C75", cursor: "pointer" }}><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add choice — differs by category type */}
                {cat.category_type === "component" ? (
                  isPickingChoice ? (
                    <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.10)", padding: "10px" }}>
                      <div style={{ position: "relative", marginBottom: "8px" }}>
                        <Search size={12} color="#787E87" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }} />
                        <input placeholder="Search component SKUs..." value={choiceSearch} onChange={e => setChoiceSearch(e.target.value)} style={{ ...inputStyle, width: "100%", paddingLeft: "26px" }} />
                      </div>
                      <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                        {filteredComponents.map(comp => {
                          const alreadyAdded = cat.choices?.some(c => c.component_sku_id === comp.id)
                          return (
                            <div key={comp.id} onClick={() => !alreadyAdded && addComponentChoice(cat.id, comp)}
                              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", cursor: alreadyAdded ? "default" : "pointer", opacity: alreadyAdded ? 0.4 : 1 }}>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, color: "#A91E22" }}>{comp.sku_code}</span>
                              <span style={{ fontSize: "12px", color: "#E0E2E6", fontFamily: "'Barlow', sans-serif", flex: 1 }}>{comp.name}</span>
                              {alreadyAdded ? <span style={{ fontSize: "10px", color: "#5A9E5A" }}>Added</span> : <Plus size={12} color="#787E87" />}
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => { setChoicePicker(null); setChoiceSearch("") }} style={{ marginTop: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8B919A", background: "none", border: "none", cursor: "pointer" }}>Done</button>
                    </div>
                  ) : (
                    <button onClick={() => setChoicePicker(cat.id)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6A9CC8", background: "transparent", border: "1px solid rgba(106,156,200,0.3)", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Plus size={12} /> Add Component Choice
                    </button>
                  )
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input placeholder="e.g. Right, Standard, 35in..." value={newSpecValue} onChange={e => setNewSpecValue(e.target.value)} onKeyDown={e => e.key === "Enter" && addSpecChoice(cat.id)} style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => addSpecChoice(cat.id)} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "#C4A93A", border: "none", padding: "8px 14px", cursor: "pointer" }}>Add</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add new category */}
      <div style={{ background: "#161A1D", border: "0.5px dashed rgba(255,255,255,0.15)", padding: "12px 14px", display: "flex", gap: "8px", alignItems: "end" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>New Option Category</label>
          <input placeholder="e.g. Shaft, Grip, Ferrule, Hand, Length" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategory()} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div style={{ width: "150px" }}>
          <label style={labelStyle}>Type</label>
          <select value={newCategoryType} onChange={e => setNewCategoryType(e.target.value as any)} style={{ ...inputStyle, width: "100%", cursor: "pointer" }}>
            <option value="component">Component</option>
            <option value="spec">Spec (text)</option>
          </select>
        </div>
        <button onClick={addCategory} disabled={saving || !newCategoryName.trim()} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: !newCategoryName.trim() ? "#3A3F47" : "#A91E22", border: "none", padding: "8px 16px", cursor: !newCategoryName.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
          + Add Category
        </button>
      </div>
      <p style={{ fontSize: "11px", color: "#666C75", fontFamily: "'Barlow', sans-serif", margin: 0 }}>
        <strong style={{ color: "#9BA0A8" }}>Component</strong> categories (Shaft, Grip, Ferrule) let you pick from real component SKUs — the chosen one becomes a build component automatically. <strong style={{ color: "#9BA0A8" }}>Spec</strong> categories (Hand, Length) are just descriptive choices with no inventory link.
      </p>
    </div>
  )
}