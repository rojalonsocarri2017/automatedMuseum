AFRAME.registerComponent('star-sky', {
    schema: {
      color: { type: 'string', default: "#FFF" },
      radius: { type: 'number', default: 300, min: 0 },
      depth: { type: 'number', default: 300, min: 0 },
      size: { type: 'number', default: 1, min: 0 },
      count: { type: 'number', default: 10000, min: 0 },
      texture: { type: 'asset', default: '' }
    },
  
    update: function() {
      let textureOptions = {};
      if (this.data.texture) {
        const loader = new THREE.TextureLoader();
        textureOptions.map = loader.load(this.data.texture);
        textureOptions.transparent = true;
      }
  
      // Generate star positions
      const positions = new Float32Array(this.data.count * 3);
      for (let i = 0; i < this.data.count; i++) {
        const vec = this.randomVectorBetweenSpheres(this.data.radius, this.data.depth);
        positions[i * 3] = vec.x;
        positions[i * 3 + 1] = vec.y;
        positions[i * 3 + 2] = vec.z;
      }
  
      // Create BufferGeometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
      // Create material
      const material = new THREE.PointsMaterial(Object.assign(textureOptions, {
        color: this.data.color,
        size: this.data.size
      }));
  
      // Create Points object
      const points = new THREE.Points(geometry, material);
  
      // Attach to entity
      this.el.setObject3D('star-system', points);
    },
  
    remove: function() {
      this.el.removeObject3D('star-system');
    },
  
    randomVectorBetweenSpheres: function(radius, depth) {
      const randomRadius = Math.random() * depth + radius;
      return this.randomSphereSurfaceVector(randomRadius);
    },
  
    randomSphereSurfaceVector: function(radius) {
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    }
  });
  