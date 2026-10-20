"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./demo.module.css";

const stages = [
  { at: 0, text: "Préparation de la simulation…" },
  { at: 22, text: "Analyse du catalogue exemple (1 248 produits)…" },
  { at: 50, text: "Correspondance fictive des fiches et variantes…" },
  { at: 77, text: "Vérification simulée des images et des stocks…" },
  { at: 100, text: "Simulation terminée. Aucun transfert réel n’a été effectué." },
];

export default function Demo() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function startSimulation() {
    if (running) return;
    if (timer.current) clearInterval(timer.current);
    setProgress(0);
    setComplete(false);
    setRunning(true);
    timer.current = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + 6 + Math.random() * 13);
        if (next >= 100) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setRunning(false);
          setComplete(true);
          return 100;
        }
        return next;
      });
    }, 360);
  }

  const stage = [...stages].reverse().find((item) => progress >= item.at)?.text ?? stages[0].text;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="OMNI — retour à l’accueil"><span className={styles.brandMark}>O</span><span>OMNI <small>STUDIO</small></span></a>
        <span className={styles.headerNote}><i /> DÉMO INTERACTIVE</span>
      </header>
      <div className={styles.container}>
        <div className={styles.kicker}><span className={styles.kickerLine} /> SERVICE LOCAL <span>•</span> ANNECY-LE-VIEUX</div>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <div className={styles.eyebrow}>PASSERELLE E-COMMERCE</div>
            <h1>Passez d’Amazon<br />à Shopify, simplement.</h1>
            <p className={styles.intro}>Un accompagnement local pour préparer le transfert de votre catalogue vers Shopify, avec un périmètre défini et des données vérifiées ensemble.</p>
            <div className={styles.price}>1 290 € <small>mise en place pilote</small></div>
            <div className={styles.support}>+ 49 €/mois <span>support facultatif</span></div>
            <button className={styles.button} onClick={startSimulation} disabled={running}>
              {running ? "Simulation en cours…" : complete ? "Relancer la simulation" : "Lancer une simulation de migration"}<span aria-hidden="true">↗</span>
            </button>
            <p className={styles.disclaimer}>Démo fictive : aucune connexion à Amazon ou Shopify, aucun produit ni client importé.</p>
          </div>
          <aside className={styles.preview} aria-live="polite">
            <div className={styles.previewTop}><div><i className={styles.pulse} /> SIMULATEUR</div><span>APERÇU 01</span></div>
            <div className={styles.flow}>
              <div className={styles.platform}><span className={styles.amazonIcon}>a</span><span><b>Amazon</b><small>Catalogue source (exemple)</small></span><i className={styles.flowCheck}>✓</i></div>
              <div className={styles.flowLine}><span style={{ height: `${progress}%` }} /></div>
              <div className={styles.platform}><span className={styles.shopifyIcon}>s</span><span><b>Shopify</b><small>Boutique de destination (exemple)</small></span><i className={complete ? styles.flowCheck : styles.flowPending}>{complete ? "✓" : "·"}</i></div>
            </div>
            <div className={styles.progressLabel}><span>{stage}</span><b>{Math.round(progress)}%</b></div>
            <div className={styles.bar} role="progressbar" aria-label="Avancement de la simulation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
            <div className={styles.log}>
              <div className={styles.logHeader}><span>JOURNAL DE SIMULATION</span><span>{running ? "EN COURS" : complete ? "TERMINÉ" : "EN ATTENTE"}</span></div>
              <p><i className={styles.logDot} />{progress === 0 ? "Prêt. Cliquez pour démarrer la démonstration." : stage}</p>
              {complete && <p className={styles.logComplete}><i>✓</i> Simulation terminée — aucun transfert réel n’a été effectué.</p>}
            </div>
            <div className={styles.previewFoot}><span>MODE MAQUETTE</span><span>DONNÉES FICTIVES</span></div>
          </aside>
        </section>
        <section className={styles.details}>
          <div><span className={styles.detailIcon}>01</span><p><b>Un périmètre maîtrisé</b><small>Produits, variantes, images et stocks : à confirmer avant tout pilote.</small></p></div>
          <div><span className={styles.detailIcon}>02</span><p><b>Un devis transparent</b><small>Prix indicatif, ajusté après évaluation du catalogue et des besoins.</small></p></div>
          <div><span className={styles.detailIcon}>03</span><p><b>Un accompagnement local</b><small>Un premier échange pour vérifier si le projet est adapté à votre boutique.</small></p></div>
        </section>
        <footer className={styles.footer}><a href="/">← Retour à OMNI</a><span>Passerelle · Annecy</span><span>Tarifs et résultats à confirmer avant tout engagement.</span></footer>
      </div>
    </main>
  );
}
