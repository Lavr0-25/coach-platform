'use client'

import { useState } from 'react'

interface EmojiPickerProps {
  onEmojiSelect?: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  
  const emojis = ['😀', '😂', '', '❤️', '🎉', '🔥', '👏', '', '👍', '😊', '', '', '', '']
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0 text-xl"
        title="Добавить эмодзи"
      >
        
      </button>
      
      {showPicker && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute bottom-full right-0 mb-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-20">
            <div className="grid grid-cols-7 gap-1">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onEmojiSelect?.(emoji)
                    setShowPicker(false)
                  }}
                  className="text-2xl hover:bg-gray-100 p-1.5 rounded transition-colors"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}