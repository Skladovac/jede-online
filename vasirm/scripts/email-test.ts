// Zkušební e-mail o poptávce (ověří BREVO_API_KEY a LEAD_EMAILS). Nic neukládá do databáze.
//   npx tsx --conditions=react-server scripts/email-test.ts
import { notifyLead } from '../src/lib/email'

notifyLead({
  subject: 'TEST – upozornění na poptávku z webu VRM',
  rows: [
    ['Co to je', 'Zkušební e-mail. Takhle budou chodit poptávky z formulářů na webu.'],
    ['Jméno', 'Zkušební zájemce'],
    ['Telefon', '+420 000 000 000'],
  ],
  adminPath: '/admin/poptavky',
})
  .then(() => console.log(process.env.BREVO_API_KEY ? 'Odesláno přes Brevo.' : 'Bez BREVO_API_KEY — jen vypsáno do logu.'))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => import('../src/lib/prisma').then((m) => m.prisma.$disconnect()))
