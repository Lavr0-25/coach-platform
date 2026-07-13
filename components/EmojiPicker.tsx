'use client'

import { useState } from 'react'

interface EmojiPickerProps {
  onEmojiSelect?: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  
  // Оптимизированный набор эмодзи
  const emojis = [
    '😀', '😂', '🥰', '❤️',  '🔥','',
    '👏', '😊', '😎', '🤔',  '👌','',
    '🙏', '💪', '✨', '🌟', '🎯', '💯'
  ]
  
  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect?.(emoji)
    setShowPicker(false)
  }

  return (
    <div className="relative">
      {/* Кнопка с иконкой смайлика */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        title="Добавить эмодзи"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      
      {showPicker && (
        <>
          {/* Затемнение фона при клике вне */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPicker(false)}
          />
          {/* Панель с эмодзи */}
          <div className="absolute bottom-full right-0 mb-2 p-3 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-72">
            <div className="grid grid-cols-6 gap-1">
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl hover:bg-gray-100 p-2 rounded-lg transition-colors flex items-center justify-center w-10 h-10"
                  type="button"
                  title={emoji}
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