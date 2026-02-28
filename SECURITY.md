# Política de seguridad

## Versiones soportadas

Solo las versiones del proyecto que figuren como mantenidas reciben actualizaciones de seguridad. Revisa las [releases](https://github.com/pablojhdcoder/hack-udc-2026/releases) y las etiquetas del repositorio.

## Cómo reportar una vulnerabilidad

Agradecemos los reportes de vulnerabilidades de forma responsable.

1. **No abras un issue público** para una vulnerabilidad de seguridad.
2. **Contacta a los mantenedores** por un canal privado:
   - Abre un issue con la etiqueta **security** y marca el contenido como confidencial si usas GitHub, o
   - Envía un correo a los mantenedores del proyecto (contacto indicado en el README o en el perfil del repositorio).
3. **Incluye**, si es posible:
   - Descripción clara del problema y pasos para reproducirlo.
   - Impacto esperado (confidencialidad, integridad, disponibilidad).
   - Entorno (versiones de Node, sistema operativo, etc.).
   - Sugerencia de mitigación o parche si la tienes.

## Qué puedes esperar

- **Reconocimiento de recepción** en un plazo razonable (objetivo: menos de 7 días).
- **Evaluación** del reporte y decisión sobre si se considera una vulnerabilidad.
- **Comunicación** sobre el plan de corrección y, si aplica, coordinación para una divulgación responsable (por ejemplo, publicación de un aviso y release con fix tras un período de gracia para actualizar).

No utilizamos programas de recompensas por bugs; el reporte es voluntario y agradecemos tu ayuda para mejorar la seguridad del proyecto.

## Buenas prácticas en este proyecto

- **No subas credenciales** (API keys, contraseñas) al repositorio. Usa `.env` y asegúrate de que esté en `.gitignore`.
- **Dependencias:** recomendamos revisar avisos de `npm audit` y mantener dependencias actualizadas.
