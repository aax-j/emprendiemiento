# SaaS para Talleres Mecánicos - Requerimientos del Proyecto

## 1. Requerimientos Funcionales
El core del negocio se centra en optimizar el flujo de trabajo de un taller, desde que entra el auto hasta que el cliente paga.

### Módulo de Autenticación y Roles:
- Inicio de sesión seguro.
- Control de acceso basado en roles (Ej: Administrador ve finanzas; Mecánico solo ve las órdenes de trabajo asignadas).

### Módulo de Agenda y Citas:
- Creación, edición y cancelación de turnos.
- Visualización dual (Tarjetas para la vista diaria, Calendario para la vista mensual/semanal).
- Asignación de estados a las citas (Pendiente, En Taller, Finalizado).

### Módulo de Gestión de Clientes y Vehículos:
- Registro de datos de contacto de clientes.
- Asociación de múltiples vehículos a un solo cliente.
- Historial de servicios y mantenimientos por placa/matrícula.

### Módulo de Órdenes de Trabajo (Core):
- Generación de una orden cuando el vehículo ingresa.
- Asignación de mecánicos a tareas específicas.
- Listado de repuestos y servicios utilizados en la reparación.

### Módulo de Inventario (Básico):
- Registro de stock de repuestos comunes.
- Alertas automáticas de stock mínimo.

### Módulo de Facturación y Reportes:
- Generación de comprobantes de pago.
- Dashboard de métricas (ingresos, servicios solicitados, vehículos atendidos).

---

## 2. Requerimientos No Funcionales

### Diseño Visual Minimalista y de Alto Contraste:
- Interfaces hiper-simplificadas.
- Paleta limpia (fondos claros) con acentos sólidos (esmeralda, ámbar, rojo) para estados.

### Experiencia de Usuario (Fricción Cero):
- Sidebar de navegación siempre visible.
- Acciones principales en 2-3 clics.
- Uso de modales para acciones rápidas.

### Arquitectura y Rendimiento:
- Desktop-First.
- Sincronización instantánea (PostgreSQL).

### Seguridad:
- Encriptación de contraseñas.
- Multi-tenancy (aislamiento de datos por taller).

### Modelo de Negocio:
- Aplicación de suscripción (SaaS).