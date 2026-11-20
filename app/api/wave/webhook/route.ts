import { NextResponse, type NextRequest } from "next/server";
import { enregistrerSiPayee, type SessionWave } from "@/lib/wave";
import { verifierSecretPartage, verifierSignatureWebhook } from "@/lib/waveSignature";

export const dynamic = "force-dynamic";

/**
 * Webhook Wave : https://www.begnanandaloacup.com/api/wave/webhook (à déclarer dans le portail Wave Business).
 * Wave y envoie « checkout.session.completed » quand un supporter a payé : les billets de la réservation
 * passent alors à « payé » et leur QR code s'affiche. Le secret du webhook (WAVE_WEBHOOK_SECRET) prouve
 * que l'appel vient bien de Wave : signature HMAC (Wave-Signature) ou secret partagé (Authorization).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ erreur: "webhook non configuré" }, { status: 503 });

  // Corps brut : la signature se calcule dessus, avant toute lecture JSON.
  const corps = await request.text();
  const signature = request.headers.get("wave-signature");
  const authentique = signature
    ? verifierSignatureWebhook(signature, corps, secret)
    : verifierSecretPartage(request.headers.get("authorization"), secret);
  if (!authentique) return NextResponse.json({ erreur: "signature invalide" }, { status: 401 });

  let evenement: { id?: string; type?: string; data?: SessionWave };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return NextResponse.json({ erreur: "corps invalide" }, { status: 400 });
  }

  // Les autres événements (paiement refusé, autres services Wave) ne changent rien aux billets :
  // la réservation reste payable jusqu'à l'expiration de la session.
  if (evenement.type !== "checkout.session.completed" || !evenement.data?.id) return NextResponse.json({ ok: true });

  try {
    await enregistrerSiPayee(evenement.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Session inconnue (paiement Wave qui ne vient pas de la billetterie) : rien à faire, pas de nouvel essai.
    if (message.includes("Session Wave inconnue")) return NextResponse.json({ ok: true, ignore: true });
    // Montant différent du total : billets laissés non payés, à vérifier par le comité (pas de nouvel essai).
    if (message.includes("Montant Wave")) {
      console.error("Webhook Wave", evenement.id, message);
      return NextResponse.json({ ok: true, ignore: true });
    }
    console.error("Webhook Wave", evenement.id, message);
    // Erreur passagère (base injoignable, etc.) : Wave réessaie plus tard.
    return NextResponse.json({ erreur: "enregistrement impossible" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
