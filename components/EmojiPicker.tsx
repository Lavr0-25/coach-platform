'use client'

interface EmojiPickerProps {
  onEmojiSelect?: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  // Временная заглушка вместо @emoji-mart/react
  // Можно заменить на любой другой emoji picker
  
  const emojis = ['😀', '😂', '', '❤️', '🎉', '🔥', '👏', '']
  
  return (
    <div className="flex gap-1 p-2 bg-white border rounded-lg shadow-sm">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onEmojiSelect?.(emoji)}
          className="text-xl hover:bg-gray-100 p-1 rounded transition-colors"
          type="button"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}