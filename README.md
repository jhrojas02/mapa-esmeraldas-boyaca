# Guía de exploración esmeraldífera · Occidente de Boyacá

Aplicación web (versión preliminar 2) del **Modelo A** de la tesis *Algoritmos de mapeo inteligente de zonas de
exploración esmeraldífera en el occidente de Boyacá* (Ciencia de Datos, Universidad Externado de Colombia).

Es una **guía de exploración**: ayuda a decidir dónde recorrer primero. No dice dónde hay esmeralda.

Permite:
- ver las zonas de potencial (alto / incierto / bajo, con su nivel de confianza) en cuadros de **100 m** sobre imagen satelital;
- al acercarse, ver **corredores de exploración** a 30 m (roca favorable cerca de crestas de pliegues, fallas o
  cruces de fallas) y las fallas, pliegues y contactos geológicos;
- tocar un punto y saber su zona, **qué es lo que más pesa** allí, si está en un corredor, la **profundidad estimada
  de la Formación Muzo** (donde la cubre la Formación Capotes) y si está dentro de un **título minero** de la ANM;
- buscar un pueblo, vereda o municipio, o usar la ubicación del teléfono, y ver las áreas de potencial alto cercanas;
- ver **por qué** un cuadro puede tener (o no) esmeralda, en frases sencillas, y abrir una **explicación detallada**
  (cómo se decidió la zona, qué variables suben o bajan el puntaje con sus valores reales frente a los típicos de las
  zonas con minas, estabilidad de la clasificación y qué no sabe el modelo allí);
- **instalarla en el celular** y usarla **sin señal** (guarda los datos y las partes del mapa ya vistas), y compartir
  un punto con un enlace;
- consultar una **guía de campo** con las señales que acompañan a la esmeralda (lutita negra, vetas de calcita,
  albitita, pirita, brechas).

**Cómo se generó:** modelo bayesiano jerárquico (presencia-fondo) ajustado con inferencia variacional (ADVI de rango
completo, en GPU) sobre celdas de 100 m, corrigiendo el sesgo de que las minas conocidas están cerca de las vías, con geología 1:100.000 del Servicio Geológico Colombiano, FABDEM (terreno sin bosque),
Sentinel-2, ESA WorldCover, geoquímica de sedimentos (Mantilla et al., 2007), guías del depósito de La Pava
(González-Durán et al., 2021) y OpenStreetMap. Validado dejando por fuera un distrito minero a la vez.

El mapa **no muestra la ubicación de minas** y todavía no incluye el conocimiento de los mineros. Los títulos mineros
se muestran sin nombres de titulares. Es una página estática (HTML, CSS y JavaScript con Leaflet y proj4js); no tiene
servidor ni recoge datos de quien la usa.

Fuentes con licencia: FABDEM © Univ. de Bristol (CC BY-NC-SA 4.0); imagen satelital © Esri; mapas base © OpenStreetMap
y OpenTopoMap.
