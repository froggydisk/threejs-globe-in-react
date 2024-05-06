import React, { useRef, useEffect } from "react";
import "./App.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { gsap } from "gsap";

const ThreeCube = () => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const contextRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const isIntersectingRef = useRef(false);
  const minMouseDownFlagRef = useRef(false);
  const mouseDownRef = useRef(false);
  const grabbingRef = useRef(false);
  const twinkleTime = 0.03;
  let controls, materials, material, baseMesh;

  const vertex = `
    #ifdef GL_ES
    precision mediump float;
    #endif
  
    uniform float u_time;
    uniform float u_maxExtrusion;
  
    void main() {
  
      vec3 newPosition = position;
      if(u_maxExtrusion > 1.0) newPosition.xyz = newPosition.xyz * u_maxExtrusion + sin(u_time);
      else newPosition.xyz = newPosition.xyz * u_maxExtrusion;
  
      gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
  
    }
  `;
  const fragment = `
    #ifdef GL_ES
    precision mediump float;
    #endif
  
    uniform float u_time;
  
    vec3 colorA = vec3(0, 1, 0.48);
    vec3 colorB = vec3(0, 0.75, 0.36);
  
    void main() {
  
      vec3  color = vec3(0.0);
      float pct   = abs(sin(u_time));
            color = mix(colorA, colorB, pct);
  
      gl_FragColor = vec4(color, 1.0);
  
    }`;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.z = 100;

  const setControls = () => {
    controls = new OrbitControls(camera, rendererRef.current.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.enableDamping = true;
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 2 - 0.5;
    controls.maxPolarAngle = Math.PI / 2 + 0.5;
  };

  const setBaseSphere = () => {
    const baseSphere = new THREE.SphereGeometry(19.5, 35, 35);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x054d74,
      transparent: true,
      opacity: 0.7,
    });
    baseMesh = new THREE.Mesh(baseSphere, baseMaterial);
    scene.add(baseMesh);
  };

  const setShaderMaterial = () => {
    materials = [];
    material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        u_time: { value: 1.0 },
        u_maxExtrusion: { value: 1.0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
  };

  const setMap = () => {
    let activeLatLon = {};
    const dotSphereRadius = 20;

    const readImageData = (imageData) => {
      for (
        let i = 0, lon = -180, lat = 90;
        i < imageData.length;
        i += 4, lon++
      ) {
        if (!activeLatLon[lat]) activeLatLon[lat] = [];

        const red = imageData[i];
        const green = imageData[i + 1];
        const blue = imageData[i + 2];

        if (red > 100 && green > 100 && blue > 100) activeLatLon[lat].push(lon);

        if (lon === 180) {
          lon = -180;
          lat--;
        }
      }
    };

    const visibilityForCoordinate = (lon, lat) => {
      let visible = false;

      if (!activeLatLon[lat].length) return visible;

      const closest = activeLatLon[lat].reduce((prev, curr) => {
        return Math.abs(curr - lon) < Math.abs(prev - lon) ? curr : prev;
      });

      if (Math.abs(lon - closest) < 0.5) visible = true;

      return visible;
    };

    const calcPosFromLatLonRad = (lon, lat) => {
      var phi = (90 - lat) * (Math.PI / 180);
      var theta = (lon + 180) * (Math.PI / 180);

      const x = -(dotSphereRadius * Math.sin(phi) * Math.cos(theta));
      const z = dotSphereRadius * Math.sin(phi) * Math.sin(theta);
      const y = dotSphereRadius * Math.cos(phi);

      return new THREE.Vector3(x, y, z);
    };

    const createMaterial = (timeValue) => {
      const mat = material.clone();
      mat.uniforms.u_time.value = timeValue * Math.sin(Math.random());
      materials.push(mat);
      return mat;
    };

    const setDots = () => {
      const dotDensity = 2.5;
      let vector = new THREE.Vector3();

      for (let lat = 90, i = 0; lat > -90; lat--, i++) {
        const radius =
          Math.cos(Math.abs(lat) * (Math.PI / 180)) * dotSphereRadius;
        const circumference = radius * Math.PI * 2;
        const dotsForLat = circumference * dotDensity;

        for (let x = 0; x < dotsForLat; x++) {
          const long = -180 + (x * 360) / dotsForLat;

          if (!visibilityForCoordinate(long, lat)) continue;

          vector = calcPosFromLatLonRad(long, lat);

          const dotGeometry = new THREE.CircleGeometry(0.1, 5);
          dotGeometry.lookAt(vector);
          dotGeometry.translate(vector.x, vector.y, vector.z);

          const m = createMaterial(i);
          const mesh = new THREE.Mesh(dotGeometry, m);

          scene.add(mesh);
        }
      }
    };

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = process.env.PUBLIC_URL + "/world_alpha_mini.jpg";

    image.onload = () => {
      image.needsUpdate = true;

      const canvas = contextRef.current;
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      readImageData(imageData.data);

      setDots();
    };
  };

  const resize = () => {
    if (window.innerWidth > 700) camera.position.z = 100;
    else camera.position.z = 140;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
  };

  const mousemove = (event) => {
    isIntersectingRef.current = false;

    mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    const intersects = raycasterRef.current.intersectObject(baseMesh);
    if (intersects[0]) {
      isIntersectingRef.current = true;
      if (!grabbingRef.current) document.body.style.cursor = "pointer";
    } else {
      if (!grabbingRef.current) document.body.style.cursor = "default";
    }
  };

  const mousedown = () => {
    if (!isIntersectingRef.current) return;

    materials.forEach((el) => {
      gsap.to(el.uniforms.u_maxExtrusion, { value: 1.07 });
    });

    mouseDownRef.current = true;
    minMouseDownFlagRef.current = false;

    setTimeout(() => {
      minMouseDownFlagRef.current = true;
      if (!mouseDownRef.current) mouseup();
    }, 500);

    document.body.style.cursor = "grabbing";
    grabbingRef.current = true;
  };

  const mouseup = () => {
    mouseDownRef.current = false;
    if (!minMouseDownFlagRef.current) return;

    materials.forEach((el) => {
      gsap.to(el.uniforms.u_maxExtrusion, { value: 1.0, duration: 0.15 });
    });

    grabbingRef.current = false;
    if (isIntersectingRef.current) document.body.style.cursor = "pointer";
    else document.body.style.cursor = "default";
  };

  const listenTo = () => {
    window.addEventListener("resize", resize.bind(this));
    window.addEventListener("mousemove", mousemove.bind(this));
    window.addEventListener("mousedown", mousedown.bind(this));
    window.addEventListener("mouseup", mouseup.bind(this));
  };

  const render = () => {
    materials.forEach((el) => {
      el.uniforms.u_time.value += twinkleTime;
    });

    controls.update();
    rendererRef.current.render(scene, camera);
    requestAnimationFrame(render.bind(this));
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    rendererRef.current = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      alpha: true,
    });
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    scene.add(new THREE.HemisphereLight(0xffffcc, 0x080820, 2.5));

    setControls();
    setBaseSphere();
    setShaderMaterial();
    setMap();
    resize();
    listenTo();
    render();

    // 컴포넌트 언마운트 시 Three.js 리소스 정리
    return () => {
      rendererRef.current.dispose();
    };
  }, []); // 초기화는 한 번만 실행

  return (
    <div className="container" ref={containerRef}>
      <canvas className="canvas" ref={canvasRef} />
      <canvas ref={contextRef} style={{ display: "none" }} />
    </div>
  );
};

export default ThreeCube;
