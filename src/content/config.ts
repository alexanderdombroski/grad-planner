import { defineCollection, z } from 'astro:content'

const coursePrerequisiteSchema = z.object({
  courseCode: z.string(),
  title: z.string(),
  minimumGrade: z.string(),
  notes: z.string(),
})

const courseRequirementSchema = z.object({
  majorCode: z.string(),
  majorName: z.string(),
  requirementGroup: z.string(),
  requirementType: z.enum(['required', 'elective', 'support', 'general_education']),
  isRequired: z.boolean(),
})

const courses = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    courseCode: z.string(),
    subjectCode: z.string(),
    courseNumber: z.string(),
    title: z.string(),
    credits: z.number().int().positive(),
    description: z.string(),
    isActive: z.boolean(),
    prerequisites: z.array(coursePrerequisiteSchema),
    majorRequirements: z.array(courseRequirementSchema),
  }),
})

export const collections = {
  courses,
}
