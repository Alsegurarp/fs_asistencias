// Dentro de un contenedor, «localhost» es el propio contenedor. El portal local
// manda a identidad en localhost:8082, así que este puente reenvía los puertos
// 8081 y 8082 del contenedor a los mismos puertos de la computadora.
import net from 'node:net';
const destino = process.env.PUENTE_DESTINO || 'host.docker.internal';
for (const puerto of [8081, 8082]) {
  net.createServer((entrada) => {
    const salida = net.connect(puerto, destino);
    entrada.pipe(salida).pipe(entrada);
    entrada.on('error', () => salida.destroy());
    salida.on('error', () => entrada.destroy());
  }).listen(puerto, '127.0.0.1');
}
console.log(`puente: localhost:8081 y :8082 → ${destino}`);
