export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { to, subject, body, customerId, customerName, cagnotte, tier } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Destinataire, sujet et contenu requis' });
  }

  // Génère l'URL du QR code si on a un customerId
  const qrCodeUrl = customerId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`MUNCHY-CLIENT-${customerId}`)}&format=png&bgcolor=16162A&color=FFFFFF`
    : null;

  // Section QR code dans l'email
  const qrSection = qrCodeUrl ? `
    <div style="text-align: center; padding: 24px; background: #1E1E35; border-radius: 12px; margin: 20px 0;">
      <div style="font-size: 14px; color: #FFD600; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px;">
        🎴 TA CARTE DE FIDÉLITÉ
      </div>
      <div style="background: white; padding: 10px; border-radius: 12px; display: inline-block; box-shadow: 0 0 20px rgba(255,61,127,0.4);">
        <img src="${qrCodeUrl}" alt="QR Code fidélité" width="160" height="160" style="display: block; border-radius: 8px;" />
      </div>
      <div style="font-size: 11px; color: #8888AA; margin-top: 10px;">
        Montre ce QR code en boutique pour être identifié instantanément
      </div>
      ${tier ? `<div style="margin-top: 8px; background: rgba(255,61,127,0.2); border: 1px solid rgba(255,61,127,0.4); border-radius: 20px; padding: 4px 14px; display: inline-block; font-size: 12px; color: #FF3D7F; font-weight: bold;">${tier}</div>` : ''}
      ${cagnotte !== undefined ? `<div style="margin-top: 8px; font-size: 18px; font-weight: bold; color: #00E676;">💰 Cagnotte : ${Number(cagnotte).toFixed(2)}€</div>` : ''}
      <div style="font-size: 10px; color: #555588; margin-top: 6px; letter-spacing: 2px;">
        MUNCHY'S CANDY CLUB · #${String(customerId).slice(-6).padStart(6,'0')}
      </div>
    </div>
  ` : '';

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
            <div style="background: linear-gradient(135deg, #FF3D7F, #9B51E0 50%, #00C2FF); padding: 28px; text-align: center;">
              <div style="font-size: 48px;">🍬</div>
              <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: white; margin-top: 4px;">MUNCHY'S CANDY</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 4px; letter-spacing: 2px;">PROGRAMME DE FIDÉLITÉ</div>
            </div>

            <!-- Body -->
            <div style="padding: 28px; background: #16162A; font-size: 14px; line-height: 1.8; color: #E0E0E0;">
              ${body.replace(/\n/g, '<br>')}
            </div>

            <!-- QR Code section -->
            ${qrSection}

            <!-- Footer -->
            <div style="padding: 20px; background: #0D0D1A; text-align: center; font-size: 11px; color: #8888AA; border-top: 1px solid #ffffff10;">
              <div style="margin-bottom: 6px;">🍬 Munchy's Candy · contact@munchyscandy.fr</div>
              <div>Société Kalice · BE 0750.497.413</div>
              <div style="margin-top: 8px;">
                <a href="mailto:contact@munchyscandy.fr?subject=Désabonnement" style="color: #FF3D7F; text-decoration: none; font-size: 10px;">Se désabonner</a>
              </div>
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
