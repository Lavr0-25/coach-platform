export default function MessagesEmpty() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">💬</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Выберите диалог
        </h2>
        <p className="text-gray-600">
          Выберите собеседника слева или напишите новому автору
        </p>
      </div>
    </div>
  )
}