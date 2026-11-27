"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Decision, Salida } from "@prisma/client";
import type { DatosFicha } from "@/lib/consultas";
import { CATEGORIA, DECISION, ESTADO, ESTADO_PETICION, SALIDA, fecha } from "@/lib/textos";
import { enviar } from "@/lib/cola";
import { comprimir } from "@/lib/imagen";

type Props = {
  a: DatosFicha;
  zonas: { id: string; nombre: string }[];
  editar: boolean;
  responsable: boolean;
  anterior?: string | null;
  siguiente?: string | null;
  cerrar?: string | null;
  posicion?: string;
};

export default function Ficha({ a, zonas, editar, responsable, anterior, siguiente, cerrar, posicion }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [decision, setDecision] = useState<Decision>(a.decision);
  const [zona, setZona] = useState<string | null>(a.zonaDestinoId);
  const [salida, setSalida] = useState<Salida | null>(a.salida);
  const [notas, setNotas] = useState(a.notasDecision ?? "");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [fotoSel, setFotoSel] = useState<string | null>(a.fotos[0]?.id ?? null);
  const [subiendo, setSubiendo] = useState(0);
  const [previas, setPrevias] = useState<string[]>([]);
  const camara = useRef<HTMLInputElement>(null);

  // Al cambiar de artículo, reinicia el estado local.
  useEffect(() => {
    setFotoSel(null);
    setMsg(null);
  }, [a.id]);
  // Al llegar datos nuevos del servidor, sincroniza sin borrar el mensaje.
  useEffect(() => {
    setDecision(a.decision);
    setZona(a.zonaDestinoId);
    setSalida(a.salida);
  }, [a.id, a.decision, a.zonaDestinoId, a.salida]);
  useEffect(() => setNotas(a.notasDecision ?? ""), [a.id, a.notasDecision]);
  const nFotos = a.fotos.length;
  useEffect(() => setPrevias([]), [a.id, nFotos]);

  // Al pasar al artículo siguiente, vuelve arriba de la ficha.
  const raiz = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = raiz.current?.closest(".panel-ficha");
    if (panel) panel.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [a.id]);

  // Sin conexión no se refresca: la página daría error. La cola refresca al vaciarse.
  const refrescar = () => {
    if (navigator.onLine) startTransition(() => router.refresh());
  };

  async function guardarDecision(d: Decision, z: string | null, s: Salida | null, n = notas) {
    setMsg(null);
    if (d === "llevar" && !z) return setMsg({ tipo: "error", texto: "Elige la zona de destino para guardar «Se lleva»." });
    if (d === "no_llevar" && !s) return setMsg({ tipo: "error", texto: "Elige qué se hace con él para guardar «No se lleva»." });
    const r = await enviar({
      url: `/api/articulos/${a.id}/decision`, metodo: "POST",
      json: { decision: d, zonaDestinoId: z, salida: s, notasDecision: n || null },
      descripcion: `Decisión de ${a.codigo}`,
    });
    if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
    const z2 = zonas.find((x) => x.id === z)?.nombre;
    const texto = d === "llevar" ? `Guardado: se lleva a ${z2}.` : d === "no_llevar" ? `Guardado: no se lleva · ${SALIDA[s!]}.` : "Guardado como pendiente.";
    setMsg({ tipo: "ok", texto: r.enCola ? `${texto} Se enviará al volver la conexión.` : texto });
    if (!r.enCola) refrescar();
  }

  function elegirDecision(d: Decision) {
    setDecision(d);
    setMsg(null);
    if (d === "pendiente") guardarDecision("pendiente", null, null);
    if (d === "llevar" && zona && a.decision !== "llevar") guardarDecision("llevar", zona, null);
    if (d === "no_llevar" && salida && a.decision !== "no_llevar") guardarDecision("no_llevar", null, salida);
  }

  async function subirFotos(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    for (const file of Array.from(files)) {
      setSubiendo((n) => n + 1);
      try {
        const { grande, ancho, alto } = await comprimir(file);
        setPrevias((p) => [...p, URL.createObjectURL(grande)]);
        const r = await enviar({
          url: `/api/articulos/${a.id}/fotos`, metodo: "POST",
          partes: [
            { nombre: "foto", blob: grande, archivo: "foto.jpg" },
            { nombre: "ancho", valor: String(ancho) },
            { nombre: "alto", valor: String(alto) },
          ],
          descripcion: `Foto de ${a.codigo}`,
        });
        if (!r.ok) setMsg({ tipo: "error", texto: r.error });
        else if (r.enCola) setMsg({ tipo: "ok", texto: "Foto guardada en el móvil. Se subirá al volver la conexión." });
      } catch {
        setMsg({ tipo: "error", texto: "No se ha podido leer la imagen." });
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (camara.current) camara.current.value = "";
    refrescar();
  }

  async function accion(url: string, json: unknown, ok: string, metodo = "POST") {
    setMsg(null);
    const r = await enviar({ url, metodo, json, descripcion: `${a.codigo}` });
    if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
    setMsg({ tipo: "ok", texto: r.enCola ? `${ok} Se enviará al volver la conexión.` : ok });
    if (!r.enCola) refrescar();
    return r;
  }

  const fotoGrande = fotoSel ?? a.fotos[0]?.id;
  const abiertas = a.peticiones.filter((p) => p.estado === "abierta");

  return (
    <article className="ficha" aria-labelledby="ficha-titulo" ref={raiz}>
      <div className="ficha-barra">
        {cerrar ? <Link href={cerrar} className="boton" scroll={false}>← Volver</Link> : <span />}
        <span className="sutil">{posicion}</span>
        <Link href={`/a/${a.codigo}`} className="sutil">{a.codigo}</Link>
      </div>

      <div className="foto-principal">
        {fotoGrande ? (
          <img src={`/api/fotos/${fotoGrande}`} alt={`Foto de ${a.nombre}`} />
        ) : previas.length ? (
          <img src={previas[previas.length - 1]} alt={`Foto de ${a.nombre}, pendiente de subir`} />
        ) : (
          <span>Sin foto</span>
        )}
      </div>
      {(a.fotos.length > 1 || previas.length > 0) && (
        <div className="fotos-mini" role="group" aria-label="Fotos">
          {a.fotos.map((f, i) => (
            <button key={f.id} type="button" aria-pressed={fotoGrande === f.id} onClick={() => setFotoSel(f.id)} aria-label={`Ver foto ${i + 1}${f.principal ? " (principal)" : ""}`}>
              <img src={`/api/fotos/${f.id}?mini`} alt="" />
            </button>
          ))}
          {previas.map((p) => (
            <button key={p} type="button" disabled aria-label="Foto pendiente de subir"><img src={p} alt="" /></button>
          ))}
        </div>
      )}
      {editar && (
        <div className="fila" style={{ margin: "8px 0" }}>
          <input ref={camara} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => subirFotos(e.target.files)} id={`camara-${a.id}`} />
          <button type="button" className="primario" onClick={() => camara.current?.click()} disabled={subiendo > 0}>
            {subiendo ? "Subiendo foto…" : "📷 Añadir foto"}
          </button>
          {fotoGrande && a.fotos.length > 1 && !a.fotos.find((f) => f.id === fotoGrande)?.principal && (
            <button type="button" onClick={() => accion(`/api/fotos/${fotoGrande}/principal`, {}, "Foto principal cambiada.")}>Hacer principal</button>
          )}
          {fotoGrande && (
            <button type="button" className="peligro" onClick={() => confirm("¿Borrar esta foto?") && accion(`/api/fotos/${fotoGrande}`, {}, "Foto borrada.", "DELETE").then(() => setFotoSel(null))}>
              Borrar foto
            </button>
          )}
        </div>
      )}

      <h1 id="ficha-titulo" style={{ marginTop: 12, marginBottom: 4 }}>{a.nombre}</h1>
      <p className="sutil" style={{ marginTop: 0 }}>
        {a.codigo} · {a.sala} · {a.cantidad} {a.cantidad === 1 ? "unidad" : "unidades"}
        {a.medidas ? ` · ${a.medidas}` : ""}
      </p>
      {(a.padre || a.partes.length > 0) && (
        <p className="sutil">
          {a.padre ? <>Separado de <Link href={`/a/${a.padre}`}>{a.padre}</Link>. </> : null}
          {a.partes.length > 0 && <>Partes separadas: {a.partes.map((p, i) => <span key={p.codigo}>{i ? ", " : ""}<Link href={`/a/${p.codigo}`}>{p.codigo}</Link> ({p.cantidad})</span>)}.</>}
        </p>
      )}

      <h2>Decisión</h2>
      {!editar ? (
        <p><span className={`etiqueta ${a.decision}`}>{a.etiqueta}</span></p>
      ) : (
        <>
          <div className="decision" role="group" aria-label="Decisión">
            {(["pendiente", "llevar", "no_llevar"] as Decision[]).map((d) => (
              <button key={d} type="button" className={d} aria-pressed={decision === d} onClick={() => elegirDecision(d)}>
                {DECISION[d]}
              </button>
            ))}
          </div>
          {decision === "llevar" && (
            <>
              <p className="sutil" id="zona-tit">¿A qué zona de la oficina nueva?</p>
              <div className="opciones" role="group" aria-labelledby="zona-tit">
                {zonas.map((z) => (
                  <button key={z.id} type="button" aria-pressed={zona === z.id} onClick={() => { setZona(z.id); guardarDecision("llevar", z.id, null); }}>
                    {z.nombre}
                  </button>
                ))}
              </div>
            </>
          )}
          {decision === "no_llevar" && (
            <>
              <p className="sutil" id="salida-tit">¿Qué hacemos con él?</p>
              <div className="opciones" role="group" aria-labelledby="salida-tit">
                {(Object.keys(SALIDA) as Salida[]).map((s) => (
                  <button key={s} type="button" aria-pressed={salida === s} onClick={() => { setSalida(s); guardarDecision("no_llevar", null, s); }}>
                    {SALIDA[s]}
                  </button>
                ))}
              </div>
              {salida === "ofrecer_equipo" && <p className="sutil">Aparece en el mercadillo para que el equipo lo pida.</p>}
            </>
          )}
          <div className="campo">
            <label htmlFor={`notas-${a.id}`}>Notas</label>
            <textarea id={`notas-${a.id}`} value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
          {notas !== (a.notasDecision ?? "") && (
            <button type="button" onClick={() =>
              decision === a.decision
                ? guardarDecision(a.decision, a.zonaDestinoId, a.salida, notas)
                : guardarDecision(decision, decision === "llevar" ? zona : null, decision === "no_llevar" ? salida : null, notas)
            }>Guardar notas</button>
          )}
        </>
      )}
      <div aria-live="polite">{msg && <p className={msg.tipo === "ok" ? "ok-banda" : "error"} role={msg.tipo === "error" ? "alert" : undefined}>{msg.texto}</p>}</div>
      {a.decididoPor && <p className="sutil">Decidido por {a.decididoPor}, {fecha(a.decididoEn, true)}.</p>}

      {editar && a.cantidad > 1 && <Dividir a={a} onHecho={(c) => { setMsg({ tipo: "ok", texto: `Unidades separadas en ${c}. Ya puedes decidir cada parte por su lado.` }); refrescar(); }} />}

      {(a.salida === "ofrecer_equipo" || a.peticiones.length > 0) && (
        <section>
          <h2>Peticiones del equipo</h2>
          {!a.peticiones.length && <p className="sutil">Nadie lo ha pedido todavía.</p>}
          <ul className="lista">
            {a.peticiones.map((p, i) => (
              <li key={p.id}>
                <div className="fila" style={{ justifyContent: "space-between" }}>
                  <span>
                    <b>{i + 1}. {p.nombre}</b> · {p.cantidad} {p.cantidad === 1 ? "ud." : "uds."} · {fecha(p.creadaEn, true)}
                  </span>
                  <span className={`etiqueta ${p.estado === "asignada" || p.estado === "recogida" ? "llevar" : p.estado === "abierta" ? "info" : "pendiente"}`}>
                    {ESTADO_PETICION[p.estado]}
                  </span>
                </div>
                {p.comentario && <p className="sutil" style={{ margin: "4px 0" }}>«{p.comentario}»</p>}
                {p.recogidaLimite && p.estado === "asignada" && <p className="sutil" style={{ margin: "4px 0" }}>Recogida antes del {fecha(p.recogidaLimite)}</p>}
                {responsable && p.estado === "abierta" && (
                  <button type="button" onClick={() => accion(`/api/articulos/${a.id}/asignar`, { peticionId: p.id }, `Asignado a ${p.nombre}.`)}>Asignar a esta persona</button>
                )}
                {responsable && p.estado === "asignada" && (
                  <button type="button" onClick={() => accion(`/api/peticiones/${p.id}/recogida`, {}, "Marcado como recogido.")}>Marcar como recogido</button>
                )}
              </li>
            ))}
          </ul>
          {responsable && abiertas.length > 0 && (
            <button type="button" className="primario" style={{ marginTop: 8 }} onClick={() => accion(`/api/articulos/${a.id}/asignar`, {}, "Asignado por orden de llegada.")}>
              Asignar por orden de llegada
            </button>
          )}
        </section>
      )}

      <details>
        <summary>Datos del artículo</summary>
        <Datos a={a} editar={editar} onGuardar={(d) => accion(`/api/articulos/${a.id}`, d, "Datos guardados.", "PATCH")} />
      </details>

      <details>
        <summary>Historial ({a.eventos.length})</summary>
        <ul className="lista">
          {a.eventos.map((e) => (
            <li key={e.id} className="sutil">
              <b>{e.quien}</b> · {fecha(e.cuando, true)}
              <br />
              {e.tipo === "importacion" ? `Importado del inventario: «${e.despues}»` : (
                <>
                  {e.campo ? `${e.campo}: ` : ""}
                  {e.antes ? <><s>{e.antes}</s> → </> : null}
                  {e.despues ?? "vacío"}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>

      {(anterior || siguiente) && (
        <nav className="nav-ficha" aria-label="Artículos de la sala">
          {anterior ? <Link href={anterior} className="boton" scroll={false}>← Anterior</Link> : <span />}
          <span className="sutil">{posicion}</span>
          {siguiente ? <Link href={siguiente} className="boton primario" scroll={false}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </article>
  );
}

function Dividir({ a, onHecho }: { a: DatosFicha; onHecho: (codigo: string) => void }) {
  const [n, setN] = useState(1);
  const [error, setError] = useState<string | null>(null);
  return (
    <details>
      <summary>Dividir unidades</summary>
      <p className="sutil">Separa unidades de esta línea para darles otra decisión. Por ejemplo, 4 se llevan y 2 van al mercadillo.</p>
      <div className="fila">
        <label htmlFor={`dividir-${a.id}`} style={{ margin: 0 }}>Unidades a separar</label>
        <input id={`dividir-${a.id}`} type="number" min={1} max={a.cantidad - 1} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ width: 90 }} />
        <button type="button" onClick={async () => {
          setError(null);
          const r = await enviar({ url: `/api/articulos/${a.id}/dividir`, metodo: "POST", json: { cantidad: n }, descripcion: `División de ${a.codigo}` });
          if (!r.ok) setError(r.error);
          else onHecho(r.datos.codigo ?? "una línea nueva");
        }}>Separar {n} de {a.cantidad}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </details>
  );
}

function Datos({ a, editar, onGuardar }: { a: DatosFicha; editar: boolean; onGuardar: (d: Record<string, unknown>) => void }) {
  if (!editar)
    return (
      <dl>
        <dt>Categoría</dt><dd>{CATEGORIA[a.categoria]}</dd>
        <dt>Estado</dt><dd>{a.estado ? ESTADO[a.estado] : "Sin valorar"}</dd>
        <dt>Medidas</dt><dd>{a.medidas ?? "Sin medidas"}</dd>
        {a.descripcion && <><dt>Descripción</dt><dd>{a.descripcion}</dd></>}
      </dl>
    );
  return (
    <form
      key={a.id}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onGuardar(Object.fromEntries(fd.entries()));
      }}
    >
      <div className="campo"><label htmlFor={`n-${a.id}`}>Nombre</label><input id={`n-${a.id}`} name="nombre" defaultValue={a.nombre} required /></div>
      <div className="fila" style={{ alignItems: "flex-start" }}>
        <div className="campo" style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor={`c-${a.id}`}>Categoría</label>
          <select id={`c-${a.id}`} name="categoria" defaultValue={a.categoria}>
            {Object.entries(CATEGORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor={`e-${a.id}`}>Estado</label>
          <select id={`e-${a.id}`} name="estado" defaultValue={a.estado ?? ""}>
            <option value="">Sin valorar</option>
            {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="campo"><label htmlFor={`m-${a.id}`}>Medidas</label><input id={`m-${a.id}`} name="medidas" defaultValue={a.medidas ?? ""} placeholder="Ancho x fondo x alto" /></div>
      <div className="campo"><label htmlFor={`d-${a.id}`}>Descripción</label><textarea id={`d-${a.id}`} name="descripcion" defaultValue={a.descripcion ?? ""} /></div>
      {a.original && <p className="sutil">En el inventario original: «{a.original}»</p>}
      <button className="primario">Guardar datos</button>
    </form>
  );
}
