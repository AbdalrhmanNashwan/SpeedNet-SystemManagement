# API Reference (implemented)

Base prefix: `/api`. All routes except `/auth/login` and `/auth/refresh` require a
Bearer access token. Write routes enforce roles (see ARCHITECTURE.md).

## Auth
- `POST /auth/login`   (form: username=email, password) → `{access_token, refresh_token}`
- `POST /auth/refresh?refresh_token=...` → new token pair
- `GET  /auth/me` → current user

## Towers   (read: any · write: editor · patch: agent+ with zone scope)
- `GET    /towers?zone_id=&area=&reseller=&status_=`
- `GET    /towers/{id}`
- `POST   /towers`
- `PATCH  /towers/{id}`
- `DELETE /towers/{id}`

## Devices   `{dtype}` = links | switches | sectors | servers
- `GET    /devices/{dtype}?tower_id=`
- `POST   /devices/{dtype}`
- `PATCH  /devices/{dtype}/{id}`
- `DELETE /devices/{dtype}/{id}`
- `POST   /devices/{dtype}/{id}/transfer`  body `{to_type?, to_tower_id?}`
        → move between sections and/or to another tower

## Zones   (write: editor)
- `GET /zones` · `POST /zones` · `PATCH /zones/{id}` · `DELETE /zones/{id}`
- `POST /zones/{id}/recompute` → re-assign towers by the zone's rule (reseller/area)

## IP allocations   (write: editor)
- `GET /ip-allocations` · `POST` · `PATCH /{id}` · `DELETE /{id}`

## Users   (admin only)
- `GET /users` · `POST /users` · `PATCH /users/{id}` · `DELETE /users/{id}`

## Audit   (editor+)
- `GET /audit?limit=&entity=` → recent changes, newest first
