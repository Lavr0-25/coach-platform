export default function MessagesEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50/50 to-blue-50/50 p-8">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-purple-100 mb-6">
        <span className="text-5xl">💬</span>
      </div>
      <h2 className="text-2xl font-bold gradient-text mb-3">
        Выберите диалог
      </h2>
      <p className="text-gray-600 text-center max-w-sm leading-relaxed">
        Выберите собеседника из списка слева или начните общение с новым автором, чтобы задать вопрос по курсу.
      </p>
    </div>
  )
}