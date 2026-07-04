'use client'

export default function DeleteButton() {
  return (
    <button
      type="submit"
      className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 text-sm w-full"
      onClick={() => {
        if (!confirm('Удалить урок?')) {
          event?.preventDefault()
        }
      }}
    >
      Удалить
    </button>
  )
}