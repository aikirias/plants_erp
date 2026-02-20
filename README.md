# Medusa ERP Plantas (Docker)

Stack completo con Medusa backend + storefront Next.js para una empresa de venta de plantas.

## Servicios

- Backend Medusa: `http://localhost:9000`
- Admin Medusa: `http://localhost:9000/app`
- Storefront Next.js: `http://localhost:8100`
- PostgreSQL: `postgres:16-alpine`
- Redis: `redis:7-alpine`

## Levantar todo

```bash
docker compose up --build -d
```

## Ver logs

```bash
docker compose logs -f backend storefront
```

## Credenciales admin

- Email: `admin@plantas.local`
- Password: `supersecret`

## Catálogo inicial

Se carga automáticamente en el primer arranque:

- Monstera Deliciosa
- Ficus Lyrata
- Lavanda
- Kit Maceta + Sustrato Universal

## Reiniciar desde cero

```bash
docker compose down -v
```

Luego vuelve a correr:

```bash
docker compose up --build -d
```
