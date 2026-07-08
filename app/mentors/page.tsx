import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function MentorsPage() {
  const supabase = await createClient()

  const { data: mentors, error } = await supabase
    .from('coaches')
    .select(`
      id,
      display_name,
      specialization,
      bio,
      user_id
    `)
    .in('role', ['mentor', 'admin'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading mentors:', error)
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            👨‍🏫 Наставники
          </h1>
          <p className="text-gray-600 text-lg">
            Лучшие специалисты готовы поделиться знаниями
          </p>
        </div>

        {mentors && mentors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mentors.map((mentor) => (
              <Link
                key={mentor.id}
                href={`/profile/${mentor.user_id}`}
                className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                    {mentor.display_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1 truncate">
                      {mentor.display_name}
                    </h3>
                    {mentor.specialization && (
                      <p className="text-sm text-gray-600 mb-3">
                        {mentor.specialization}
                      </p>
                    )}
                    {mentor.bio && (
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {mentor.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">👨‍🏫</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Пока нет наставников
            </h2>
            <p className="text-gray-600">
              Станьте первым наставником на платформе!
            </p>
          </div>
        )}
      </div>
    </main>
  )
}