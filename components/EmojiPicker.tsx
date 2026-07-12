'use client'

import { useState } from 'react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleEmojiSelect = (emoji: any) => {
    onEmojiSelect(emoji.native)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-2xl hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
        title="Добавить эмодзи"
      >
        😊
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 z-[9999] shadow-xl rounded-lg overflow-hidden border border-gray-200">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme="light"
            locale="ru"
            previewPosition="none"
            skinTonePosition="none"
            perLine={8}
            maxFrequentRows={2}
            categories={[
              'frequent',
              'smileys',
              'people',
              'animals',
              'food',
              'activities',
              'travel',
              'objects',
              'symbols',
              'flags'
            ]}
          />
        </div>
      )}
    </div>
  )
}