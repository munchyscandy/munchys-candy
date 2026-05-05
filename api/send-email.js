export default async function handler(req, res) {
  // Autoriser les requêtes depuis l'app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Destinataire, sujet et contenu requis' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Munchy's Candy <contact@munchyscandy.fr>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D0D1A; color: #ffffff; padding: 0; border-radius: 16px; overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #FF3D7F, #9B51E0 50%, #00C2FF); padding: 24px; text-align: center;">
              <div style="font-size: 40px;">🍬</div>
              <div style="font-size: 22px; font-weight: bold; letter-spacing: 3px; color: white;">MUNCHY'S CANDY</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8);">Programme de Fidélité</div>
            </div>
            <!-- Body -->
            <div style="padding: 32px; background: #16162A;">
              ${body.replace(/\n/g, '<br>').replace(/✅/g, '✅').replace(/⏳/g, '⏳').replace(/🎁/g, '🎁').replace(/🎉/g, '🎉')}
            </div>
            <!-- Footer -->
            <div style="padding: 16px; background: #0D0D1A; text-align: center; font-size: 11px; color: #8888AA;">
              Munchy's Candy · contact@munchyscandy.fr<br>
              <a href="mailto:contact@munchyscandy.fr" style="color: #FF3D7F;">Se désabonner</a>
            </div>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(400).json({ error: data.message || 'Erreur envoi email' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
