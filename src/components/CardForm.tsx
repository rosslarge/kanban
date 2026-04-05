import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { TagBadge } from '@/components/TagBadge'
import { DEFAULT_TAGS, COLUMN_ORDER, COLUMN_CONFIG } from '@/lib/constants'
import type { Card, ColumnId, Priority, CardLink } from '@/types'

interface CardFormProps {
  initial?: Partial<Card>
  defaultColumnId?: ColumnId
  onSubmit: (data: {
    title: string
    description: string
    tags: string[]
    priority: Priority
    category: string
    links: CardLink[]
    notes: string
    columnId: ColumnId
  }) => void
  onCancel: () => void
  submitLabel?: string
}

export function CardForm({ initial, defaultColumnId = 'ideas', onSubmit, onCancel, submitLabel = 'Create' }: CardFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [customTag, setCustomTag] = useState('')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [links, setLinks] = useState<CardLink[]>(initial?.links ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [columnId, setColumnId] = useState<ColumnId>(initial?.columnId ?? defaultColumnId)

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  function addCustomTag() {
    const t = customTag.trim()
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t])
    }
    setCustomTag('')
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: '', url: '' }])
  }

  function updateLink(i: number, field: keyof CardLink, value: string) {
    setLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({ title: title.trim(), description, tags, priority, category, links: links.filter((l) => l.url), notes, columnId })
  }

  const columnOptions = COLUMN_ORDER.map((id) => ({ value: id, label: COLUMN_CONFIG[id].title }))
  const priorityOptions: { value: Priority; label: string }[] = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's the project or idea?"
          autoFocus
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the project, problem it solves, or motivation..."
          rows={3}
        />
      </div>

      {/* Column + Priority + Category */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Column</label>
          <Select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value as ColumnId)}
            options={columnOptions}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Priority</label>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            options={priorityOptions}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Productivity"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {DEFAULT_TAGS.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              active={tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
        </div>
        {tags.filter((t) => !DEFAULT_TAGS.includes(t)).map((tag) => (
          <TagBadge
            key={tag}
            tag={tag}
            active
            onClick={() => toggleTag(tag)}
            className="mr-1.5 mb-1.5"
          />
        ))}
        <div className="flex gap-2 mt-2">
          <Input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
            placeholder="Add custom tag..."
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="sm" onClick={addCustomTag}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* Links */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</label>
          <Button type="button" variant="ghost" size="sm" onClick={addLink}>
            <Plus size={14} /> Add link
          </Button>
        </div>
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={link.label}
                onChange={(e) => updateLink(i, 'label', e.target.value)}
                placeholder="Label (e.g. GitHub)"
                className="w-32"
              />
              <Input
                value={link.url}
                onChange={(e) => updateLink(i, 'url', e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(i)}>
                <Trash2 size={14} className="text-gray-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes / Retrospective</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lessons learned, what went well, what to improve next time..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 text-sm font-medium hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
