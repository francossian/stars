export const vertexShader = `
  attribute float starSize;
  attribute vec3 starColor;
  varying vec3 vColor;
  uniform float uRadius;

  void main() {
    float camDist = length(position - cameraPosition);
    if (camDist > uRadius) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vColor = starColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float d = max(0.001, -mvPosition.z);
    gl_PointSize = clamp(starSize * (500.0 / d), 0.5, 128.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const fragmentShader = `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;
