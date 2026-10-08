# Panel admin autogestiva

Panel privado para administrar la cartera de clientes y vigilar el gasto de infraestructura.

- **Clientes** (`/clientes`): alta, edición, orden, búsqueda, exportación a CSV y alertas de vencimientos (dominios a 60 días o menos, pagos a 10 días o menos).
- **Infraestructura** (`/`): costos, consumo y estado de los proyectos de Neon, con detalle por proyecto (`/proyectos/[id]`).

Next.js 16, React 19, Tailwind 4. Se despliega en Vercel desde `main`.

## Dónde vive cada cosa

| Qué | Dónde |
| --- | --- |
| Clientes y usuarios administradores | **Supabase** (tabla `clients`, Supabase Auth y tabla `admin_users`) |
| Costos e infraestructura | **Neon**, solo lectura por su API. No guarda datos de la app |
| Claves | Variables de entorno (Vercel) y `.env.local` en local. Nunca en Git |

## Variables de entorno

Copiá `.env.example` a `.env.local`.

| Variable | Para qué |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de Supabase (solo servidor) |
| `NEON_API_KEY` | API key de Neon para leer costos e infraestructura |
| `BETTER_AUTH_SECRET` | Opcional. Secreto de sesión; si falta se deriva de la clave de Supabase |

En Vercel, cargalas en Settings > Environment Variables para **Production** y hacé Redeploy después de cambiarlas.

## Puesta en marcha desde cero

1. Creá un proyecto en Supabase y ejecutá en el SQL Editor, en este orden, `supabase/clients.sql` y `supabase/admin_users.sql`.
2. En Supabase, Authentication > Users > Add user: creá el administrador con **Auto Confirm User** marcado. Usá una contraseña larga y única.
3. Autorizalo como administrador (cambiá el email):

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'tu@email.com';
   ```

4. En Authentication > Providers > Email, desactivá **Allow new users to sign up**.
5. Completá `.env.local` y corré:

   ```bash
   npm install
   npm run dev
   ```

   La app queda en http://localhost:3000.

## Seguridad

- El acceso exige una cuenta de Supabase Auth **y** estar en `admin_users`. Tener solo la cuenta no alcanza.
- Todas las rutas `/api/clients/*` y `/api/neon/*` exigen sesión.
- La sesión dura 10 minutos y se renueva mientras la pestaña está abierta; al cerrarla expira.
- Las tablas tienen RLS activado; el servidor usa la clave secreta, que lo ignora. No uses esa clave en el navegador.
- Los botones de suspender y reactivar de Infraestructura afectan bases reales de clientes en Neon.

## Respaldo

El botón **Exportar CSV** de Clientes descarga todos los clientes. Hacelo una vez al mes y guardá los últimos meses. No hay respaldo automático.

## Flujo de trabajo

Cambios en una rama, Pull Request hacia `main` y merge; Vercel despliega solo al hacer merge.

## Estructura

- `app/`: páginas y rutas de API
- `components/`: pantallas de clientes e infraestructura, login y guardia de sesión
- `lib/`: sesión, autenticación de administradores, cliente de Supabase, cliente de Neon y alertas
- `supabase/`: SQL de las tablas
