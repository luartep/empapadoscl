import type { Metadata } from 'next'
import DescuentosClient from './DescuentosClient'

export const metadata: Metadata = { title: 'Descuentos — Empapados Admin' }

export default function DescuentosPage() {
  return <DescuentosClient />
}
