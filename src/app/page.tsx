import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { Pain } from '@/components/Pain'
import { Services } from '@/components/Services'
import { ForWhom } from '@/components/ForWhom'
import { CtaSection } from '@/components/CtaSection'
import { Footer } from '@/components/Footer'
import { PoptavkaModal } from '@/components/PoptavkaModal'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Pain />
        <Services />
        <ForWhom />
        <CtaSection />
      </main>
      <Footer />
      <PoptavkaModal />
    </>
  )
}
