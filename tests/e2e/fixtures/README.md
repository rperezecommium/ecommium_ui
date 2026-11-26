# HTTPS loopback de E2E

`loopback.crt` y `loopback.key` forman un par público de prueba, sin identidad ni
acceso a ningún servicio real. No deben usarse en despliegues. El certificado
solo identifica localhost/127.0.0.1 y se confía mediante NODE_EXTRA_CA_CERTS en
los procesos hijos aislados de la suite; no se modifica el llavero del sistema
ni se desactiva la verificación TLS. Todos los BFF son mocks en puertos efímeros.

El certificado caduca en noviembre de 2036. Si se renueva, conservar SAN
IP:127.0.0.1,DNS:localhost y actualizar ambos archivos juntos.
