# PortKiller

Extensión para **GNOME Shell** que muestra los puertos TCP en escucha en tu equipo y permite **terminar el proceso** asociado desde el panel superior, sin usar la terminal.

**UUID:** `portkiller@productdevbook`  
**Shell compatible:** GNOME 46 (según `metadata.json`; amplía `shell-version` si pruebas en otras versiones).

Repositorio upstream: [productdevbook/port-killer](https://github.com/productdevbook/port-killer).

---

## Qué hace

- Lista sockets **TCP en escucha** usando el comando del sistema `ss` (paquete **iproute2**).
- Muestra **puerto**, **nombre del proceso**, **PID** y dirección local.
- **Buscar** por número de puerto o nombre de proceso.
- Botón **Kill** con confirmación: envía **SIGTERM** al PID (`kill -TERM`).
- **Actualización automática** según intervalo configurable y opción de refrescar al instante.
- **Preferencias** para intervalo de refresco y número máximo de filas visibles en el menú.

---

## Requisitos

| Requisito | Motivo |
|-----------|--------|
| **GNOME Shell** (p. ej. 46) | La extensión solo corre en GNOME. |
| **`iproute2`** (`ss` en `/usr/bin/ss`) | Para listar puertos; sin esto verás un mensaje de error en el menú. |
| App **Extensiones** (o `gnome-extensions`) | Para activar la extensión. |

Solo podrás terminar procesos que tu usuario tenga permiso de señalizar (normalmente los tuyos). Procesos de otros usuarios o del sistema pueden requerir privilegios que la extensión no tiene.

---

## Instalación manual

1. **Clona o copia** el directorio de la extensión con el nombre exacto del UUID:

   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions
   cp -r /ruta/a/portkiller@productdevbook ~/.local/share/gnome-shell/extensions/
   ```

2. **Compila los esquemas de GSettings** (necesario para preferencias):

   ```bash
   cd ~/.local/share/gnome-shell/extensions/portkiller@productdevbook
   glib-compile-schemas schemas/
   ```

3. **Recarga GNOME Shell** para que detecte la extensión:

   - **X11:** `Alt` + `F2`, escribe `r` y pulsa Enter.
   - **Wayland:** cierra sesión y vuelve a entrar (o reinicia).

4. **Activa la extensión:**

   - Abre la aplicación **Extensiones** y activa **PortKiller**, o
   - En terminal: `gnome-extensions enable portkiller@productdevbook`

Si no aparece, comprueba que la carpeta se llama exactamente `portkiller@productdevbook` y que `metadata.json` está en la raíz de esa carpeta.

---

## Uso

1. En la barra superior aparece un icono de red/servidor (**PortKiller**).
2. Ábrelo: verás el listado (o “Scanning…” / mensaje de error si falla `ss`).
3. Usa el campo de búsqueda para filtrar por puerto o proceso.
4. Pulsa **Kill** en una fila, confirma en el diálogo; se envía SIGTERM y se refresca la lista.
5. **Refresh now** actualiza de inmediato; **Preferences** abre los ajustes.

---

## Configuración

Ajustes guardados en GSettings (`org.gnome.shell.extensions.portkiller`):

| Clave | Por defecto | Descripción |
|-------|-------------|-------------|
| `refresh-interval-seconds` | `5` | Segundos entre refrescos automáticos (mínimo efectivo en código: 2 s). |
| `max-visible-items` | `25` | Máximo de filas de puertos mostradas antes del texto “+N more ports”. |

---

## Estructura del proyecto

```
portkiller@productdevbook/
├── extension.js      # Lógica principal y menú del panel
├── prefs.js          # Ventana de preferencias (Libadwaita)
├── metadata.json     # UUID, nombre, versión, shell-version
├── stylesheet.css    # Estilos del menú y botones
└── schemas/
    └── org.gnome.shell.extensions.portkiller.gschema.xml
```

---

## Solución de problemas

- **“Could not run ss. Install iproute2.”**  
  Instala el paquete que proporciona `ss` (en muchas distros: `iproute2`).

- **No puedo matar un proceso**  
  Comprueba que el PID sea de un proceso de tu usuario; revisa notificaciones de error de la extensión.

- **La extensión no carga tras actualizar GNOME**  
  Revisa que `shell-version` en `metadata.json` incluya tu versión de Shell y vuelve a instalar/recargar.

---

## Licencia

No hay archivo `LICENSE` en esta copia del árbol; consulta el repositorio [productdevbook/port-killer](https://github.com/productdevbook/port-killer) para la licencia oficial.
