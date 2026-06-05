# Quality - Servicio Tecnico

Aplicacion web para registrar clientes, equipos celulares en reparacion, evidencia fotografica, estados de entrega, ingresos y gastos del taller usando React, CSS y Supabase.

## Instalacion

1. Instala dependencias:

```bash
npm install
```

2. Crea un proyecto en Supabase y ejecuta completo el archivo `supabase/schema.sql` desde **SQL Editor**.

3. Copia `.env.example` a `.env` y coloca tus credenciales:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
VITE_ACCESS_PASSWORD=25913229
```

4. Inicia la app:

```bash
npm run dev
```

La clave de acceso inicial es `25913229`, o la que pongas en `VITE_ACCESS_PASSWORD`.

## Roles de usuario

El sistema tiene dos roles con diferentes niveles de acceso:

**Rol Básico (clave: 25913229):**
- Puede ver y gestionar ordenes de reparación
- Puede ver "Ordenes activas recientes" y "Últimos gastos" en el panel
- No tiene acceso a métricas financieras (ingresos, gastos, rentabilidad)
- No puede ver ni gestionar la sección de Gastos
- No puede ver la sección de Logs

**Rol Administrador (clave: 11316828):**
- Acceso completo a todas las funcionalidades
- Puede ver métricas financieras completas
- Puede gestionar gastos
- Puede ver el historial de Logs
- Acceso a todas las secciones del sistema

## Funciones incluidas

- Registro de cliente, equipo, reparacion, observaciones, garantia, precio y estado.
- Campo obligatorio `Recibido por` para registrar quien recibio el equipo.
- Registro de PIN, contrasena o patron 3x3 del equipo para pruebas tecnicas.
- Fecha de ingreso automatica al crear y fecha de actualizacion al modificar.
- Estados: `Recibido`, `Reparado`, `Garantia`, `Entregado` y `Devuelto`.
- Captura o seleccion de varias fotos desde celular, guardadas en Supabase Storage.
- Listado con busqueda, edicion y eliminacion de ordenes.
- Registro, edicion y eliminacion de gastos de repuestos.
- Dashboard de ingresos diarios/semanales, gastos diarios/semanales y rentabilidad semanal.
- PWA instalable en celular, tablet y escritorio con manifest, iconos y cache del shell principal.

## PWA

Para probar la instalacion PWA en local usa:

```bash
npm run build
npm run preview
```

Abre la URL de preview en Chrome/Edge. Si el navegador lo permite, aparecera el boton de instalar en la barra superior. En iPhone/iPad se instala desde Safari con **Compartir > Agregar a pantalla de inicio**.

## Nota de seguridad

El SQL permite acceso con la llave anonima para que puedas usarlo rapido como sistema personal. Para uso con empleados o acceso publico, conviene activar Supabase Auth y endurecer las politicas RLS.

## Actualizar Supabase existente

Si ya habias ejecutado el SQL anterior, pega el contenido de `supabase/update_repair_access_fields.sql` en Supabase SQL Editor para agregar `Garantia`, `Recibido por`, PIN/clave y patron.

Para habilitar el sistema de logs y notificaciones, ejecuta tambien el archivo `supabase/create_repair_logs.sql` en Supabase SQL Editor. Esto creara la tabla de auditoria y los triggers necesarios para registrar todos los cambios en las reparaciones.

Para registrar tambien los cambios en gastos (crear, editar, eliminar), ejecuta el archivo `supabase/add_expenses_logs.sql` en Supabase SQL Editor.
