'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatingProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  className?: string
}

export function Rating({ 
  rating, 
  maxRating = 5, 
  size = 'md',
  showValue = false,
  className 
}: RatingProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            className={cn(sizeClasses[size], 'fill-yellow-400 text-yellow-400')}
          />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star className={cn(sizeClasses[size], 'text-gray-300')} />
            <Star
              className={cn(sizeClasses[size], 'absolute top-0 left-0 fill-yellow-400 text-yellow-400 clip-path-half')}
              style={{ clipPath: 'inset(0 50% 0 0)' }}
            />
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            className={cn(sizeClasses[size], 'text-gray-300')}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm text-gray-600 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

interface RatingInputProps {
  value: number
  onChange: (rating: number) => void
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RatingInput({ 
  value, 
  onChange, 
  maxRating = 5,
  size = 'md',
  className 
}: RatingInputProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: maxRating }).map((_, i) => {
        const starValue = i + 1
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(starValue)}
            className="focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
          >
            <Star
              className={cn(
                sizeClasses[size],
                starValue <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300 hover:text-yellow-300'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

