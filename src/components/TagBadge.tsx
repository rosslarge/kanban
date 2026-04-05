import { tagColor } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  tag: string
  className?: string
  onClick?: () => void
  active?: boolean
}

export function TagBadge({ tag, className, onClick, active }: TagBadgeProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-all',
        tagColor(tag),
        onClick && 'cursor-pointer hover:opacity-80',
        active && 'ring-2 ring-offset-1 ring-current',
        className
      )}
    >
      {tag}
    </span>
  )
}
