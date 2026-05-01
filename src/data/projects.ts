export type Project = {
  id: string
  name: string
  description: string
  url?: string
  image?: string
  stack: string[]
  tags: ('web' | 'ecommerce' | 'landing' | 'app')[]
  year?: number
  status?: 'live' | 'wip' | 'archived'
}

export const projects: Project[] = [
  {
    id: 'placeholder-1',
    name: 'Proyecto en construcción',
    description: 'Pronto verás aquí uno de mis trabajos.',
    stack: ['React', 'TypeScript', 'Tailwind'],
    tags: ['web'],
    status: 'wip',
  },
  {
    id: 'placeholder-2',
    name: 'Proyecto en construcción',
    description: 'Pronto verás aquí uno de mis trabajos.',
    stack: ['Next.js', 'Node', 'Postgres'],
    tags: ['ecommerce'],
    status: 'wip',
  },
  {
    id: 'placeholder-3',
    name: 'Proyecto en construcción',
    description: 'Pronto verás aquí uno de mis trabajos.',
    stack: ['Astro', 'Tailwind', 'CMS'],
    tags: ['landing'],
    status: 'wip',
  },
  {
    id: 'placeholder-4',
    name: 'Proyecto en construcción',
    description: 'Pronto verás aquí uno de mis trabajos.',
    stack: ['React', 'Vite', 'Three.js'],
    tags: ['web'],
    status: 'wip',
  },
]

export const filterTags = ['todos', 'web', 'ecommerce', 'landing', 'app'] as const
export type FilterTag = (typeof filterTags)[number]
