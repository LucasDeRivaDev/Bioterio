import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GenERatsBrand from '../components/GenERatsBrand'
import { Dna, BarChart2, Archive, Calendar, Skull, Printer, GraduationCap, Microscope, FlaskConical, Building2 } from 'lucide-react'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');
  .landing-root { font-family: 'Inter', sans-serif; background: #050810; color: #c9d4e0; overflow-x: hidden; }
  .landing-root .mono { font-family: 'JetBrains Mono', monospace; }
  .landing-root .glow-green { box-shadow: 0 0 30px rgba(0,230,118,0.15); }
  .landing-root .text-glow-green { text-shadow: 0 0 20px rgba(0,230,118,0.4); }
  .landing-root .grid-bg {
    background-image: linear-gradient(rgba(0,230,118,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .landing-root .card { background: rgba(13,21,40,0.8); border: 1px solid rgba(30,51,82,0.8); backdrop-filter: blur(10px); }
  .landing-root .gradient-text {
    background: linear-gradient(135deg, #00e676 0%, #40c4ff 50%, #ce93d8 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
  @keyframes pulse-green { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .landing-root .float { animation: float 4s ease-in-out infinite; }
  .landing-root .pulse-green { animation: pulse-green 2s ease-in-out infinite; }
  .landing-root .feature-card { transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
  .landing-root .feature-card:hover { transform: translateY(-4px); border-color: rgba(0,230,118,0.3); box-shadow: 0 8px 40px rgba(0,230,118,0.08); }
  .landing-root ::-webkit-scrollbar { width: 6px; }
  .landing-root ::-webkit-scrollbar-track { background: #050810; }
  .landing-root ::-webkit-scrollbar-thumb { background: rgba(30,51,82,0.8); border-radius: 3px; }
  .landing-root a { color: inherit; }
`

const NavLink = ({ href, children }) => (
  <a href={href} style={{ color: '#8a9bb0', textDecoration: 'none', fontSize: '14px', padding: '8px 14px', borderRadius: '8px', transition: 'color 0.2s' }}
    onMouseOver={e => e.target.style.color = '#00e676'}
    onMouseOut={e => e.target.style.color = '#8a9bb0'}>
    {children}
  </a>
)

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
}

export default function Landing() {
  const { sesion } = useAuth()

  useEffect(() => {
    const prev = document.title
    document.title = 'GenERats — Sistema de Gestión de Bioterio'
    return () => { document.title = prev }
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const btn = document.getElementById('submitBtn')
    const msg = document.getElementById('formMsg')
    btn.textContent = 'Enviando...'
    btn.style.opacity = '0.6'
    setTimeout(() => {
      msg.style.display = 'block'
      msg.style.background = 'rgba(0,230,118,0.1)'
      msg.style.border = '1px solid rgba(0,230,118,0.3)'
      msg.style.color = '#00e676'
      msg.textContent = '✓ ¡Mensaje recibido! Te contactamos a la brevedad.'
      btn.style.display = 'none'
    }, 800)
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── NAVBAR ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(5,8,16,0.85)', borderBottom: '1px solid rgba(0,230,118,0.1)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GenERatsBrand iconSize={44} nameSize={26} sloganSize={11} sublineSize={0} gap={10} showSlogan={false} showSubline={false} align="left" iconPrefix="navBrand" />
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NavLink href="#features">Funciones</NavLink>
            <NavLink href="#como-funciona">¿Cómo funciona?</NavLink>
            <NavLink href="#pricing">Planes</NavLink>
            {/* LOGIN / BIOTERIO */}
            {sesion ? (
              <Link to="/"
                style={{ marginLeft: '8px', padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', color: '#00e676', background: 'rgba(0,230,118,0.08)', border: '1.5px solid rgba(0,230,118,0.3)', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(0,230,118,0.18)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(0,230,118,0.08)'}
              >
                Bioterio →
              </Link>
            ) : (
              <Link to="/login"
                style={{ marginLeft: '8px', padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', color: '#40c4ff', background: 'rgba(64,196,255,0.08)', border: '1.5px solid rgba(64,196,255,0.3)', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(64,196,255,0.18)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(64,196,255,0.08)'}
              >
                Ingresar →
              </Link>
            )}
            <a href="#contacto"
              style={{ marginLeft: '4px', padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', color: '#00e676', background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.35)', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(0,230,118,0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(0,230,118,0.12)'}
            >
              Solicitar demo
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="grid-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(0,230,118,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(64,196,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '56px', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', marginBottom: '24px' }}>
              <span className="pulse-green" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#00e676', letterSpacing: '1px', textTransform: 'uppercase' }}>Software de bioterio</span>
            </div>

            <h1 style={{ fontSize: '52px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: '20px' }}>
              <span style={{ color: 'white' }}>Gestión inteligente</span><br />
              <span className="gradient-text">de tu colonia</span><br />
              <span style={{ color: 'white' }}>de laboratorio</span>
            </h1>

            <p style={{ fontSize: '18px', lineHeight: 1.7, color: '#8a9bb0', marginBottom: '36px', maxWidth: '480px' }}>
              GenERats centraliza el control de tu bioterio: reproductores, camadas, predicciones de parto, stock y reportes — todo en tiempo real, desde cualquier dispositivo.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="#contacto" style={{ padding: '14px 28px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', color: '#050810', background: 'linear-gradient(135deg, #00e676, #40c4ff)', boxShadow: '0 4px 24px rgba(0,230,118,0.3)' }}>
                Solicitar demo gratuito
              </a>
              <a href="#features" style={{ padding: '14px 28px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', color: '#c9d4e0', background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)' }}>
                Ver funciones →
              </a>
            </div>

            <div style={{ display: 'flex', gap: '32px', marginTop: '48px', paddingTop: '32px', borderTop: '1px solid rgba(30,51,82,0.6)' }}>
              {[['100%','#00e676','Digital, sin papel'],['24/7','#40c4ff','Acceso desde cualquier lugar'],['∞','#ce93d8','Historial de datos']].map(([val, color, label]) => (
                <div key={label}>
                  <div className="mono" style={{ fontSize: '28px', fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: '12px', color: '#4a5f7a', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Logo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingLeft: '18px' }} className="float">
            <div style={{ position: 'relative', transform: 'translateX(24px)' }}>
              <div style={{ position: 'absolute', inset: '-30px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)' }} />
              <div className="card" style={{ borderRadius: '32px', padding: '32px 38px', borderColor: 'rgba(0,230,118,0.2)', boxShadow: '0 0 60px rgba(0,230,118,0.1)' }}>
                <GenERatsBrand
                  iconSize={182}
                  nameSize={64}
                  sloganSize={24}
                  sublineSize={13}
                  gap={18}
                  align="left"
                  allowWrap
                  iconPrefix="heroBrand"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '20px', background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.2)', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#40c4ff', letterSpacing: '1px', textTransform: 'uppercase' }}>Funciones</span>
            </div>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: 'white', letterSpacing: '-1px', marginBottom: '16px' }}>Todo lo que necesita tu bioterio</h2>
            <p style={{ fontSize: '16px', color: '#8a9bb0', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
              Diseñado específicamente para la gestión de colonias de <em style={{ color: '#c9d4e0' }}>Mus musculus</em>, con parámetros biológicos incorporados.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              { icon: <Dna size={22} />,      color:'rgba(0,230,118,', title:'Motor predictivo reproductivo', desc:'Calcula automáticamente las ventanas de parto, fechas de destete y madurez reproductiva con precisión científica.', foot:'Gestación · Destete · Madurez' },
              { icon: <BarChart2 size={22} />, color:'rgba(64,196,255,', title:'Scoring de rendimiento', desc:'Evalúa la eficiencia reproductiva de cada macho por latencia de fertilización. Ranking automático con puntajes por apareamiento.', foot:'Score 10 · 7 · 5 pts por latencia' },
              { icon: <Archive size={22} />,   color:'rgba(206,147,216,', title:'Control de stock por categorías', desc:'Clasificación automática por edad: reproductores, crías, jóvenes y adultos. Se actualiza en tiempo real sin intervención manual.', foot:'5 categorías · Actualización automática' },
              { icon: <Calendar size={22} />,  color:'rgba(255,179,0,', title:'Calendario de eventos', desc:'Visualizá partos esperados, destetes y madurez reproductiva en un calendario mensual con alertas de vencimiento.', foot:'Alertas · Vencidas · Próximas' },
              { icon: <Skull size={22} />,     color:'rgba(255,107,128,', title:'Registro de sacrificios', desc:'Registrá los sacrificios por grupo con fecha, categoría y notas. El stock se descuenta automáticamente y queda el historial completo.', foot:'Trazabilidad completa · Sin errores' },
              { icon: <Printer size={22} />,   color:'rgba(0,230,118,', title:'Reportes e impresión', desc:'Generá reportes mensuales o personalizados listos para imprimir o exportar como PDF. Ideales para auditorías y registros institucionales.', foot:'PDF · Impresión directa · Filtros' },
            ].map(({ icon, color, title, desc, foot }) => (
              <div key={title} className="card feature-card" style={{ borderRadius: '20px', padding: '28px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${color}0.1)`, border: `1px solid ${color}0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${color}0.9)`, marginBottom: '20px' }}>{icon}</div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: '#8a9bb0', lineHeight: 1.6 }}>{desc}</p>
                <div className="mono" style={{ fontSize: '11px', color: '#4a5f7a', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(30,51,82,0.6)' }}>{foot}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" style={{ padding: '100px 24px', background: 'rgba(13,21,40,0.3)', borderTop: '1px solid rgba(30,51,82,0.5)', borderBottom: '1px solid rgba(30,51,82,0.5)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '20px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#00e676', letterSpacing: '1px', textTransform: 'uppercase' }}>Simple desde el día 1</span>
          </div>
          <h2 style={{ fontSize: '40px', fontWeight: 800, color: 'white', letterSpacing: '-1px', marginBottom: '60px' }}>¿Cómo funciona?</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '40px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '32px', left: 'calc(16.6% + 16px)', right: 'calc(16.6% + 16px)', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.3), transparent)' }} />
            {[
              { n:'01', color:'#00e676', bg:'rgba(0,230,118,', title:'Cargás tus animales', desc:'Registrás machos y hembras reproductoras con su código, fecha de nacimiento y linaje.' },
              { n:'02', color:'#40c4ff', bg:'rgba(64,196,255,', title:'Registrás los apareamientos', desc:'Con la fecha de cópula, el sistema calcula automáticamente la ventana de parto esperada.' },
              { n:'03', color:'#ce93d8', bg:'rgba(206,147,216,', title:'El sistema trabaja solo', desc:'Alertas automáticas, stock actualizado, ranking de reproductores y reportes listos para imprimir.' },
            ].map(({ n, color, bg, title, desc }) => (
              <div key={n}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: `${bg}0.1)`, border: `2px solid ${bg}0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', position: 'relative' }}>
                  <span className="mono" style={{ fontSize: '20px', fontWeight: 700, color }}>{n}</span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: '#8a9bb0', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA QUIÉN ── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '40px', fontWeight: 800, color: 'white', letterSpacing: '-1px', marginBottom: '16px' }}>¿Para quién es GenERats?</h2>
            <p style={{ fontSize: '16px', color: '#8a9bb0' }}>Diseñado para instituciones que trabajan con colonias de ratones de laboratorio</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
            {[
              [<GraduationCap size={36} />, '#00e676',  'Universidades',             'Facultades de medicina, biología y veterinaria con bioterios propios'],
              [<Microscope size={36} />,    '#40c4ff',  'Institutos de investigación','CONICET, INTA, ANLIS y centros de investigación biomédica'],
              [<FlaskConical size={36} />,  '#ce93d8',  'Laboratorios farmacéuticos', 'Empresas que requieren modelos animales para sus estudios'],
              [<Building2 size={36} />,     '#ffb300',  'Hospitales y clínicas',      'Centros con unidades de investigación y bioterios satelitales'],
            ].map(([icon, color, title, desc]) => (
              <div key={title} className="card" style={{ borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', color }}>{icon}</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>{title}</div>
                <div style={{ fontSize: '13px', color: '#4a5f7a', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '100px 24px', background: 'rgba(13,21,40,0.3)', borderTop: '1px solid rgba(30,51,82,0.5)', borderBottom: '1px solid rgba(30,51,82,0.5)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '20px', background: 'rgba(206,147,216,0.08)', border: '1px solid rgba(206,147,216,0.2)', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ce93d8', letterSpacing: '1px', textTransform: 'uppercase' }}>Planes</span>
          </div>
          <h2 style={{ fontSize: '40px', fontWeight: 800, color: 'white', letterSpacing: '-1px', marginBottom: '16px' }}>Elegí el modelo que mejor te funciona</h2>
          <p style={{ fontSize: '16px', color: '#8a9bb0', marginBottom: '60px' }}>Consultoría personalizada sin compromiso. Ajustamos el plan a las necesidades de tu institución.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Licencia */}
            <div className="card" style={{ borderRadius: '24px', padding: '40px', textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#8a9bb0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Licencia única</div>
              <div style={{ fontSize: '40px', fontWeight: 900, color: 'white', marginBottom: '8px' }}>A consultar</div>
              <div style={{ fontSize: '14px', color: '#4a5f7a', marginBottom: '32px' }}>Pago único · sin mensualidades</div>
              <div style={{ borderTop: '1px solid rgba(30,51,82,0.6)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Sistema completo instalado','Capacitación incluida','3 meses de soporte técnico','Acceso multiusuario'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#c9d4e0' }}>
                    <span style={{ color: '#00e676', fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#8a9bb0' }}>
                  <span style={{ color: '#4a5f7a', fontWeight: 700 }}>—</span> Updates futuros opcionales
                </div>
              </div>
              <a href="#contacto" style={{ display: 'block', marginTop: '32px', padding: '14px', borderRadius: '12px', textAlign: 'center', fontSize: '15px', fontWeight: 600, textDecoration: 'none', color: '#c9d4e0', background: 'rgba(30,51,82,0.5)', border: '1px solid rgba(30,51,82,0.8)' }}>
                Consultar precio
              </a>
            </div>

            {/* SaaS */}
            <div style={{ borderRadius: '24px', padding: '40px', textAlign: 'left', position: 'relative', overflow: 'hidden', background: 'rgba(13,21,40,0.95)', border: '1.5px solid rgba(0,230,118,0.35)', boxShadow: '0 0 40px rgba(0,230,118,0.1)' }}>
              <div style={{ position: 'absolute', top: '20px', right: '20px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00e676', textTransform: 'uppercase', letterSpacing: '1px' }}>⭐ Recomendado</span>
              </div>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#00e676', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Suscripción mensual</div>
              <div style={{ fontSize: '40px', fontWeight: 900, color: 'white', marginBottom: '8px' }}>A consultar</div>
              <div style={{ fontSize: '14px', color: '#4a5f7a', marginBottom: '32px' }}>por mes · sin contrato de permanencia</div>
              <div style={{ borderTop: '1px solid rgba(0,230,118,0.15)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Todo lo del plan licencia','Updates automáticos incluidos','Soporte técnico continuo','Nuevas funciones sin costo extra','Backup automático de datos'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#c9d4e0' }}>
                    <span style={{ color: '#00e676', fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <a href="#contacto" style={{ display: 'block', marginTop: '32px', padding: '14px', borderRadius: '12px', textAlign: 'center', fontSize: '15px', fontWeight: 700, textDecoration: 'none', color: '#050810', background: 'linear-gradient(135deg, #00e676, #40c4ff)', boxShadow: '0 4px 20px rgba(0,230,118,0.25)' }}>
                Consultar precio
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACTO ── */}
      <section id="contacto" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}><Dna size={48} style={{ color: '#00e676' }} /></div>
          <h2 style={{ fontSize: '40px', fontWeight: 800, color: 'white', letterSpacing: '-1px', marginBottom: '16px' }}>Pedí tu demo gratuito</h2>
          <p style={{ fontSize: '16px', color: '#8a9bb0', marginBottom: '48px', lineHeight: 1.7 }}>
            Te mostramos el sistema en funcionamiento con datos reales. Sin compromiso, sin tarjeta de crédito.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a9bb0', marginBottom: '8px' }}>Nombre</label>
                <input type="text" name="nombre" required placeholder="Tu nombre" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,230,118,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(30,51,82,0.8)'} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a9bb0', marginBottom: '8px' }}>Institución</label>
                <input type="text" name="institucion" placeholder="Nombre de tu institución" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,230,118,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(30,51,82,0.8)'} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a9bb0', marginBottom: '8px' }}>Email</label>
              <input type="email" name="email" required placeholder="tu@institución.edu.ar" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(0,230,118,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(30,51,82,0.8)'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#8a9bb0', marginBottom: '8px' }}>
                Mensaje <span style={{ fontWeight: 400, opacity: 0.5 }}>(opcional)</span>
              </label>
              <textarea name="mensaje" rows={3} placeholder="¿Cuántos animales manejan? ¿Qué herramienta usan actualmente?"
                style={{ ...inputStyle, resize: 'none' }}
                onFocus={e => e.target.style.borderColor = 'rgba(0,230,118,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(30,51,82,0.8)'} />
            </div>
            <button type="submit" id="submitBtn"
              style={{ padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 700, color: '#050810', background: 'linear-gradient(135deg, #00e676, #40c4ff)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,230,118,0.3)', transition: 'opacity 0.2s', fontFamily: 'inherit' }}>
              Solicitar demo gratuito →
            </button>
            <div id="formMsg" style={{ display: 'none', padding: '14px', borderRadius: '10px', textAlign: 'center', fontSize: '14px' }} />
          </form>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '42px 24px 28px', borderTop: '1px solid rgba(30,51,82,0.5)', background: 'rgba(5,8,16,0.8)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
          <GenERatsBrand iconSize={132} nameSize={72} sloganSize={28} sublineSize={15} gap={20} align="left" iconPrefix="landingFooterBrand" />
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <div className="mono" style={{ fontSize: '12px', color: '#4a5f7a', whiteSpace: 'nowrap', textAlign: 'right' }}>© 2026 GenERats</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
