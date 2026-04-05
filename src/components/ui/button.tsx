import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        variant === 'primary' && 'bg-white text-gray-800 shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow',
        variant === 'secondary' && 'bg-white/20 text-white hover:bg-white/30 border border-white/20',
        variant === 'ghost' && 'text-gray-600 hover:bg-gray-100 hover:text-gray-800',
        variant === 'destructive' && 'bg-red-500 text-white hover:bg-red-600',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'icon' && 'w-8 h-8 p-0',
        className
      )}
      {...props}
    />
  )
}
