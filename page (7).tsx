import type { Metadata } from 'next'
import POSClientV3 from './POSClientV3'

export const metadata: Metadata = {
  title: 'POS — Empapados',
}

export default function POSPage() {
  return <POSClientV3 />
}
