# Feature Specification: Saldare Backend en Google Cloud con Document AI

**Feature Branch**: `005-saldare-gcp-doc-ai`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Necesitamos configurar todo para deployar saldare back en google clode y configurar todo lo necesario para el uso de document ai. Ya tengo una cuenta en el servicio. Necesito todas las instrucciones para la correcta configuración."

## Clarifications

### Q1: Autenticación de Cloud Run
**Question**: ¿El servicio Cloud Run debe ser público (allow-unauthenticated) o validar tokens de Firebase Auth?
**Decision**: Validar Firebase Auth tokens. Cloud Run requiere autenticación — el backend valida tokens JWT del frontend Angular (spec 004). No se permite tráfico no autenticado.

### Q2: Presupuesto Mensual GCP
**Question**: ¿Cuál es el presupuesto mensual máximo para infraestructura GCP?
**Decision**: < $50 USD/mes. La configuración se optimizará para costo mínimo: min-instances=0, Cloud SQL con instancia pequeña compartida.

### Q3: Cold Start vs Latencia
**Question**: ¿Cloud Run con min-instances=0 (ahorro + cold start) o min-instances=1 (latencia baja + costo base)?
**Decision**: min-instances=0. Se prioriza ahorro de costos. Se acepta cold start de 2-3s en primera petición tras inactividad.

### Q4: Cloud SQL Tier
**Question**: ¿Qué tier de Cloud SQL usar para PostgreSQL dentro del presupuesto de < $50/mes?
**Decision**: db-f1-micro (shared-core, ~$9/mes, 0.6 GB RAM, 10 GB SSD). Mínimo viable para MVP con tráfico bajo.

### Q5: Firebase Project Scope
**Question**: ¿La configuración del proyecto Firebase (creación, service account key) está en scope de esta feature?
**Decision**: En scope. La feature incluye crear el proyecto Firebase, habilitar Authentication (email/password), generar service account key para Firebase Admin SDK, y configurarla como secreto en GCP.

### Q6: Cloud SQL Connection Method
**Question**: ¿Cómo debe conectarse Cloud Run a Cloud SQL?
**Decision**: Unix socket via Cloud SQL Auth Proxy sidecar. Conexión via `/cloudsql/<instance-connection-name>`. Seguro, sin IP pública, no requiere VPC.

### Q7: Traffic Volume
**Question**: ¿Cuál es el volumen de tráfico esperado para este servicio?
**Decision**: MVP / desarrollo (< 100 req/día, < 10 documentos procesados/día). Uso interno y pruebas.

### Q8: API Key vs Firebase Auth
**Question**: ¿Las API keys del spec 003 siguen siendo necesarias o Firebase Auth las reemplaza?
**Decision**: Firebase Auth reemplaza API keys. Solo se usa Firebase Auth. Se elimina la lógica de API keys del backend (spec 003). Todos los endpoints protegidos requieren token JWT de Firebase válido.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar Proyecto GCP y Servicios Base (Priority: P1)

Como devops/desarrollador, necesito crear y configurar el proyecto de Google Cloud con las APIs y servicios necesarios para que el backend pueda operar, incluyendo Document AI, Cloud Run, y servicios de almacenamiento de secretos.

**Why this priority**: Sin el proyecto y las APIs habilitadas, ningún otro paso es posible. Es el prerequisito absoluto para todo el despliegue.

**Independent Test**: Se puede verificar accediendo a la consola de GCP y confirmando que todas las APIs requeridas aparecen como habilitadas en el dashboard de APIs & Services.

**Acceptance Scenarios**:

1. **Given** el usuario tiene una cuenta de Google Cloud activa, **When** se ejecutan los pasos de configuración del proyecto, **Then** el proyecto existe con billing habilitado y las APIs de Document AI, Cloud Run, Cloud Build, Artifact Registry, y Secret Manager están habilitadas.
2. **Given** el proyecto GCP está creado, **When** se crea un proyecto Firebase vinculado con Authentication (email/password) habilitada y se genera una service account key, **Then** la key se almacena en Secret Manager y el backend puede validar tokens del frontend.
3. **Given** el proyecto GCP está creado, **When** se revisan las cuotas y límites regionales, **Then** las cuotas de Document AI están configuradas para la región `us-central1` y son suficientes para el tráfico esperado.

---

### User Story 2 - Configurar Document AI Processor y Service Account (Priority: P1)

Como devops/desarrollador, necesito crear un processor de Document AI (Form Parser) y una service account con los permisos necesarios para que el backend pueda invocar Document AI de forma segura.

**Why this priority**: El processor de Document AI es el componente central que habilita la extracción de datos; sin él, el backend no puede procesar documentos aunque esté desplegado.

**Independent Test**: Se puede verificar creando el processor en la consola de GCP y usando la API de Document AI con las credenciales de la service account para procesar un documento de prueba.

**Acceptance Scenarios**:

1. **Given** la API de Document AI está habilitada, **When** se crea un processor de tipo Form Parser en `us-central1`, **Then** el processor aparece en la consola con un ID único y estado activo.
2. **Given** la service account está creada, **When** se asignan los roles `roles/documentai.apiUser` y `roles/storage.objectViewer`, **Then** la service account puede invocar Document AI exitosamente.
3. **Given** las credenciales de la service account (JSON key), **When** se configuran en el backend como variable de entorno `GOOGLE_APPLICATION_CREDENTIALS`, **Then** el backend puede autenticarse y llamar a Document AI.
4. **Given** la service account no tiene los permisos adecuados, **When** el backend intenta procesar un documento, **Then** recibe un error de permisos claro (403) y no se procesa el documento.

---

### User Story 3 - Desplegar el Backend en Google Cloud Run (Priority: P2)

Como devops/desarrollador, necesito contenedorizar el backend NestJS y desplegarlo en Cloud Run para que esté disponible como servicio HTTP accesible desde el frontend.

**Why this priority**: El despliegue es necesario para que el sistema sea accesible, pero depende de que el proyecto y Document AI estén configurados primero.

**Independent Test**: Se puede verificar haciendo una petición GET al health check endpoint del servicio desplegado y obteniendo una respuesta 200. También verificando que el endpoint `/api/documents` responde correctamente.

**Acceptance Scenarios**:

1. **Given** el código del backend está listo con un Dockerfile, **When** se construye la imagen y se sube a Artifact Registry, **Then** la imagen está disponible en el registry con el tag correspondiente.
2. **Given** la imagen está en Artifact Registry, **When** se despliega en Cloud Run con las variables de entorno configuradas, **Then** el servicio responde en la URL asignada (`*.run.app`) y el health check devuelve 200.
3. **Given** el servicio está desplegado, **When** se realiza un POST a `/api/documents/upload` con un PDF válido, **Then** el documento se procesa con Document AI y se devuelve el resultado de extracción.
4. **Given** el servicio está desplegado, **When** el frontend (spec 004) apunta a la URL de Cloud Run, **Then** el flujo completo de login → upload → extracción funciona de extremo a extremo.

---

### User Story 4 - Configurar Secretos y Variables de Entorno (Priority: P2)

Como devops/desarrollador, necesito almacenar de forma segura las credenciales, claves de service account y configuraciones sensibles en Google Cloud Secret Manager, y que el backend las consuma como variables de entorno.

**Why this priority**: La seguridad de credenciales es crítica para producción, pero el sistema puede probarse inicialmente con variables de entorno directas durante el desarrollo.

**Independent Test**: Se puede verificar accediendo a Secret Manager en la consola y confirmando que los secretos existen y que el servicio Cloud Run los monta correctamente como variables de entorno.

**Acceptance Scenarios**:

1. **Given** los secretos están creados en Secret Manager, **When** se configura el despliegue de Cloud Run para montarlos, **Then** el backend lee correctamente las variables `GOOGLE_APPLICATION_CREDENTIALS`, `DOCUMENT_AI_PROCESSOR_ID`, y `DATABASE_URL`.
2. **Given** un secreto ha sido rotado, **When** se actualiza en Secret Manager y se redeploya el servicio, **Then** el backend usa la nueva versión del secreto sin modificar código.

---

### User Story 5 - Configurar Base de Datos en la Nube (Priority: P3)

Como devops/desarrollador, necesito configurar una base de datos PostgreSQL en Google Cloud (Cloud SQL) para que el backend pueda persistir documentos y resultados de extracción.

**Why this priority**: La persistencia es necesaria para el funcionamiento completo, pero durante pruebas iniciales se puede usar una base de datos local o SQLite. El MVP puede funcionar con una instancia pequeña de Cloud SQL.

**Independent Test**: Se puede verificar conectándose a la instancia de Cloud SQL con las credenciales configuradas y ejecutando las migraciones de Prisma exitosamente.

**Acceptance Scenarios**:

1. **Given** la instancia de Cloud SQL está creada, **When** se ejecutan las migraciones de Prisma (`prisma migrate deploy`), **Then** las tablas se crean correctamente en la base de datos.
2. **Given** el backend está conectado a Cloud SQL, **When** se sube un documento, **Then** el registro persiste y es recuperable en posteriores peticiones GET.
3. **Given** Cloud SQL no es accesible temporalmente, **When** el backend intenta conectarse, **Then** el sistema retorna un error 503 con un mensaje descriptivo.

---

### Edge Cases

- ¿Qué sucede cuando el usuario no tiene permisos de billing administrator y no puede habilitar billing en el proyecto?
- ¿Cómo manejar el caso donde la cuota de Document AI se excede y el procesamiento de documentos falla?
- ¿Qué pasa si el despliegue de Cloud Run falla porque la región seleccionada no tiene capacidad?
- ¿Cómo se comporta el sistema si la service account key expira o es revocada?
- ¿Qué sucede si el Cloud SQL llega a su límite de almacenamiento?
- ¿Cómo manejar migraciones de Prisma que fallan durante el despliegue?
- ¿Qué sucede con los documentos en tránsito si el servicio se redespliega durante un procesamiento activo?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El proyecto de Google Cloud MUST tener billing habilitado y las siguientes APIs activadas: Document AI API, Cloud Run Admin API, Cloud Build API, Artifact Registry API, Secret Manager API.
- **FR-002**: El proyecto MUST tener un processor de Document AI de tipo Form Parser creado en la región `us-central1`.
- **FR-003**: Debe existir una service account de GCP con los roles `roles/documentai.apiUser` asignados, y su clave JSON debe estar disponible para el backend.
- **FR-004**: El backend MUST estar contenedorizado con un Dockerfile que exponga el puerto configurado (por defecto 3000) y ejecute Node.js en modo producción.
- **FR-005**: La imagen Docker MUST publicarse en Artifact Registry (o Container Registry) en el mismo proyecto GCP.
- **FR-006**: El servicio Cloud Run MUST configurarse con las siguientes variables de entorno: `DOCUMENT_AI_PROJECT_ID`, `DOCUMENT_AI_PROCESSOR_ID`, `DOCUMENT_AI_PROCESSOR_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`, `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON key para Firebase Admin SDK). No se requiere `API_KEY` ya que Firebase Auth reemplaza la autenticación por API keys.
- **FR-007**: Los valores sensibles (credenciales de service account de GCP y Firebase, URL de base de datos) MUST almacenarse en Secret Manager y referenciarse desde Cloud Run como secretos montados.
- **FR-008**: El servicio Cloud Run MUST requerir autenticación — el backend validará tokens JWT de Firebase Auth enviados por el frontend (spec 004). No se permite tráfico no autenticado (`allow-unauthenticated` deshabilitado).
- **FR-009**: El sistema MUST proporcionar un script de despliegue o instrucciones paso a paso ejecutables que cubran desde la creación del proyecto hasta la verificación del servicio desplegado.
- **FR-010**: La base de datos PostgreSQL MUST estar disponible como Cloud SQL tier db-f1-micro (shared-core, 0.6 GB RAM, 10 GB SSD), accesible desde Cloud Run via Unix socket usando Cloud SQL Auth Proxy sidecar. La conexión usa `/cloudsql/<instance-connection-name>` y no requiere IP pública ni VPC.
- **FR-011**: El servicio Cloud Run MUST tener configurado un health check en el endpoint raíz o `/health` que devuelva 200 cuando el servicio está operativo.
- **FR-012**: El sistema MUST estar configurado para que las migraciones de Prisma se ejecuten como parte del proceso de build o despliegue.
- **FR-013**: Los logs de la aplicación MUST enviarse a Cloud Logging y ser accesibles desde la consola de GCP.
- **FR-014**: Debe existir un proyecto Firebase con Authentication habilitada (email/password provider) y una service account key para Firebase Admin SDK almacenada en Secret Manager.
- **FR-015**: El backend MUST validar tokens JWT de Firebase Auth en cada request autenticado, rechazando tokens inválidos o expirados con un error 401.

### Key Entities *(include if feature involves data)*

- **GCP Project**: Proyecto de Google Cloud que agrupa todos los recursos (servicios, service accounts, billing). Atributos clave: project ID, project number, región por defecto.
- **Document AI Processor**: Procesador de documentos configurado en Document AI. Atributos: processor ID, tipo (Form Parser), región, estado.
- **Service Account**: Cuenta de servicio de GCP usada por el backend para autenticarse contra Document AI y otros servicios. Atributos: email, roles asignados, clave JSON.
- **Cloud Run Service**: Instancia del backend NestJS desplegada como servicio serverless. Atributos: URL, región, configuración de memoria/CPU, variables de entorno, secretos montados.
- **Cloud SQL Instance**: Instancia de base de datos PostgreSQL administrada (tier db-f1-micro: shared-core, 0.6 GB RAM, 10 GB SSD). Atributos: nombre de conexión, dirección IP, credenciales de acceso, nombre de base de datos.
- **Artifact Registry Repository**: Repositorio de imágenes Docker. Atributos: nombre, formato (Docker), región.
- **Secret Manager Secret**: Secreto almacenado que contiene valores sensibles (credenciales, claves). Atributos: nombre, versión, rotación automática (si aplica).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un desarrollador nuevo puede seguir las instrucciones y completar la configuración del proyecto GCP y el despliegue del backend en menos de 2 horas.
- **SC-002**: El servicio Cloud Run responde al health check en menos de 3 segundos tras un cold start (primera petición tras inactividad).
- **SC-003**: El procesamiento de documentos funciona de extremo a extremo (upload → Document AI → respuesta) en menos de 30 segundos para archivos de hasta 5 MB.
- **SC-004**: Los logs de la aplicación son visibles en Cloud Logging con menos de 10 segundos de latencia tras un error o evento.
- **SC-005**: El costo mensual estimado de infraestructura GCP (Cloud Run, Cloud SQL, Document AI) no excede $50 USD para el volumen de tráfico esperado (< 100 req/día, < 10 documentos/día).
- **SC-006**: La service account y los secretos cumplen con el principio de mínimo privilegio — la service account solo tiene acceso a Document AI y los recursos estrictamente necesarios.

## Assumptions

- El usuario ya tiene una cuenta de Google Cloud activa con permisos de administrador (propietario del proyecto).
- El backend NestJS ya tiene integración con Document AI implementada (spec 003) y está listo para ser desplegado. La autenticación del backend debe migrarse de API keys a Firebase Auth como parte de esta feature (ver Q8).
- El frontend Angular (saldare-front, spec 004) usará Firebase Authentication, por lo que el backend depende de Firebase Admin SDK para verificar tokens. El proyecto Firebase debe crearse como parte de esta feature.
- La base de datos será PostgreSQL (compatible con las migraciones de Prisma existentes) alojada en Cloud SQL.
- El despliegue se realizará en la región `us-central1` por consistencia con la región del Document AI processor.
- El runtime de Node.js será la versión LTS actual (22.x) en el contenedor.
- Los archivos subidos se procesan en memoria sin almacenamiento persistente de archivos (según decisión de spec 003).
- Cloud Run se configura con `min-instances=0` para optimizar costos (escalar a cero en inactividad). Se acepta una latencia de cold start de 2-3 segundos en la primera petición.
- El tráfico HTTPS es terminado por Cloud Run automáticamente; no se necesita un load balancer adicional para el MVP.
- Las migraciones de Prisma se ejecutan como un paso previo al inicio del servidor (ej. `CMD prisma migrate deploy && node dist/main` en el Dockerfile).
