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

## Funciones incluidas

- Registro de cliente, equipo, reparacion, observaciones, garantia, precio y estado.
- Fecha de ingreso automatica al crear y fecha de actualizacion al modificar.
- Estados: `Recibido`, `Reparado`, `Entregado` y `Devuelto`.
- Captura o seleccion de varias fotos desde celular, guardadas en Supabase Storage.
- Listado con busqueda, edicion y eliminacion de ordenes.
- Registro, edicion y eliminacion de gastos de repuestos.
- Dashboard de ingresos diarios/semanales, gastos diarios/semanales y rentabilidad semanal.

## Nota de seguridad

El SQL permite acceso con la llave anonima para que puedas usarlo rapido como sistema personal. Para uso con empleados o acceso publico, conviene activar Supabase Auth y endurecer las politicas RLS.
