'use client'

import ReviewsSection from './ReviewsSection'

export default function CourseReviews({ courseId }: { courseId: string }) {
  return <ReviewsSection courseId={courseId} />
}