
let scene, camera, renderer, clock, deltaTime, totalTime, keyboard;

let arToolkitSource, arToolkitContext;

let markerRoot1, markerRoot2;

let mesh0, mesh1, mesh2, mesh3;

let sphereList = [];

let sphereBodies = [];

let worl, solver;

let floor;


initialize();
animate();

function initialize()
{
	scene = new THREE.Scene();

	let ambientLight = new THREE.AmbientLight( 0xcccccc, 0.5 );
	scene.add( ambientLight );
				
	camera = new THREE.Camera();
	camera.far = 20;
	scene.add(camera);

	renderer = new THREE.WebGLRenderer({
		antialias : true,
		alpha: true,
	});
	renderer.setClearColor(new THREE.Color('lightgrey'), 0)
	renderer.setSize( 640, 480 );
	renderer.domElement.style.position = 'absolute'
	renderer.domElement.style.top = '0px'
	renderer.domElement.style.left = '0px'
	document.body.appendChild( renderer.domElement );

	clock = new THREE.Clock();
	deltaTime = 0;
	totalTime = 0;

	keyboard = new Keyboard();
	
	////////////////////////////////////////////////////////////
	// setup arToolkitSource
	////////////////////////////////////////////////////////////

	arToolkitSource = new THREEx.ArToolkitSource({
		sourceType : 'webcam',
	});

	function onResize()
	{
		arToolkitSource.onResizeElement()	
		arToolkitSource.copyElementSizeTo(renderer.domElement)	
		if ( arToolkitContext.arController !== null )
		{
			arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)	
		}	
	}

	arToolkitSource.init(function onReady(){
		onResize()
	});
	
	// handle resize event
	window.addEventListener('resize', function(){
		onResize()
	});
	
	////////////////////////////////////////////////////////////
	// setup arToolkitContext
	////////////////////////////////////////////////////////////	

	// create atToolkitContext
	arToolkitContext = new THREEx.ArToolkitContext({
		cameraParametersUrl: 'data/camera_para.dat',
		detectionMode: 'mono'
	});
	
	// copy projection matrix to camera when initialization complete
	arToolkitContext.init( function onCompleted(){
		camera.projectionMatrix.copy( arToolkitContext.getProjectionMatrix() );
	});


	//Initialize world physic
	initPhysics();

	////////////////////////////////////////////////////////////
	// setup markerRoots
	////////////////////////////////////////////////////////////

	// build markerControls
	markerRoot1 = new THREE.Group();
	scene.add(markerRoot1);
	let markerControls1 = new THREEx.ArMarkerControls(arToolkitContext, markerRoot1, {
		type: 'pattern', patternUrl: "data/hiro.patt",
	})

	let geometry1	= new THREE.PlaneBufferGeometry(1,1, 4,4);
	let material1	= new THREE.MeshNormalMaterial({
		transparent: true,
		opacity: 0.5,
		side: THREE.DoubleSide
	}); 

	let material2	= new THREE.MeshBasicMaterial({
		color: 0xffff00,
		side: THREE.DoubleSide
	}); 

	mesh1 = new THREE.Mesh( geometry1, material1 );
	mesh1.rotation.x = -Math.PI/2;
	markerRoot1.add( mesh1 );

	mesh2 = new THREE.Mesh( geometry1, material1 );
	mesh2.rotation.x = -Math.PI/2;
	mesh2.position.set(2,0,1)
	markerRoot1.add( mesh2 );

	mesh3 = new THREE.Mesh( geometry1, material1 );
	mesh3.rotation.x = -Math.PI/2;
	mesh3.position.set(-1,0,1)
	markerRoot1.add( mesh3 );

	floor =getFloor();
	addFloorPhysics();

	function onProgress(xhr) { console.log( (xhr.loaded / xhr.total * 100) + '% loaded' ); }
	function onError(xhr) { console.log( 'An error happened' ); }


	new THREE.MTLLoader()
		.load( 'model3D/santa_claus/untitled.mtl', function ( materials ) {
			materials.preload();
			new THREE.OBJLoader()
				.setMaterials( materials )
				.load( 'model3D/santa_claus/untitled.obj', function ( group ) {
					mesh0 = group;
					mesh0.position.set(2,2,2);
					mesh0.scale.set(0.3,0.3,0.3);
					markerRoot1.add(mesh0);
				}, onProgress, onError );
		});
	
	addLight();

}

function update()
{
	
	updatePosition();

	keyboard.update();
	if (keyboard.isKeyPressed("W"))
		mesh0.rotation.y +=0.01;
	if (keyboard.isKeyPressed("A")||window.USER_IS_TOUCHING)
		dropPackage();

	updatePhysics();
	// update artoolkit on every frame
	if ( arToolkitSource.ready !== false )
		arToolkitContext.update( arToolkitSource.domElement );
}


function render()
{
	renderer.render( scene, camera );
}


function animate()
{
	requestAnimationFrame(animate);
	deltaTime = clock.getDelta();
	totalTime += deltaTime;
	update();
	render();
}

function updatePosition(){
	if (mesh0 !==undefined) {
		let moveDir = new THREE.Vector3(
		- mesh0.position.x,
		0,
		- mesh0.position.z
	);
		let moveDist = mesh0.position.distanceTo(new THREE.Vector3(0,mesh0.position.y,0));
		let axis = new THREE.Vector3(0,1,0);
		mesh0.translateOnAxis(moveDir, moveDist);
		mesh0.rotateOnAxis(axis,0.01);
		moveDir.multiplyScalar(-1);
		mesh0.translateOnAxis(moveDir, moveDist);
		}
}

function dropPackage() {
      sphere = addSpheres();
      addSpherePhysics(sphere); 
  }

function addSpheres() {
	const colors = ['#ffffe0','#ffd59b','#ffa474','#f47461',
		'#db4551','#b81b34','#8b0000'];
	let size = rand(5, 10);
	const geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
	const material = new THREE.MeshPhongMaterial({
		color: colors[rand(0, colors.length-1)],
		emissive: 0xaa0000,
		side: THREE.DoubleSide,
		flatShading: true
	});
	let sphere = new THREE.Mesh(geometry, material);
	sphere.position.y = mesh0.position.y;
	sphere.position.x = mesh0.position.x;
	sphere.position.z = mesh0.position.z;
	markerRoot1.add(sphere);
	sphere.userData.radius = size;
	sphereList.push({obj:sphere, date:Date.now()});
	return sphere;
}

function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -100, 0); // earth = -9.82 m/s
    world.broadphase = new CANNON.NaiveBroadphase();
    world.broadphase.useBoundingBoxes = true;
    solver = new CANNON.GSSolver();
    solver.iterations = 7;
    solver.tolerance = 0.1;
    world.solver = solver;
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;
    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;
  }

function getPhysicsMaterial() {
	let physicsMaterial = new CANNON.Material('slipperyMaterial');
	let physicsContactMaterial = new CANNON.ContactMaterial(
		physicsMaterial, physicsMaterial, 0.0, 0.3)
	world.addContactMaterial(physicsContactMaterial);
	return physicsMaterial;
}

function getFloor() {
    let geometry = new THREE.PlaneGeometry(500, 500);
    let material = new THREE.MeshBasicMaterial({Color: 0xffffff});
    let plane = new THREE.Mesh(geometry, material);
    plane.receiveShadow = true;
    plane.rotation.x = Math.PI / 2;
    markerRoot1.add(plane);
    return plane;
  }

function addFloorPhysics() {
    let q = floor.quaternion;
    let floorBody = new CANNON.Body({
      mass: 0, // mass = 0 makes the body static
      material: getPhysicsMaterial(),
      shape: new CANNON.Plane(),
      quaternion: new CANNON.Quaternion(-q._x, q._y, q._z, q._w)
    });      
    world.addBody(floorBody);
  }

  function updatePhysics() {
    world.step(1/60);
    let sphereListCopy = Array.from(sphereList);
    let sphereBodiesCopy = Array.from(sphereBodies);
    let c=0;
    for (let i = 0; i < sphereList.length; i++) {
		
      if(Date.now()-sphereList[i].date>20000){
        markerRoot1.remove(sphereList[i].obj);
        sphereListCopy.splice(c, 1);
        sphereBodiesCopy.splice(c, 1);
        c-=1;
      }
      else{
        sphereList[i].obj.position.copy(sphereBodies[i].position);
        sphereList[i].obj.quaternion.copy(sphereBodies[i].quaternion);
      }
      c+=1;
      
    }
      
  }

function addSpherePhysics(sphere) {
      let q = sphere.quaternion;
      let p = sphere.position;
      let sphereBody = new CANNON.Body({
        mass: 100,
        material: getPhysicsMaterial(),
        shape: new CANNON.Box(new CANNON.Vec3(0.1, 0.1, 0.1)),
        linearDamping: 0.0,
        quaternion: new CANNON.Quaternion(q._x, q._y, q._z, q._w),
        position: new CANNON.Vec3(p.x, p.y, p.z),
      });
      world.addBody(sphereBody);
      sphereBodies.push(sphereBody);
    return sphereBodies;
  }

function addLight(){
	let hemiLight = new THREE.HemisphereLight( 0x0000ff, 0x00ff00, 0.6 ); 
    markerRoot1.add(hemiLight);
    let ambientLight = new THREE.AmbientLight(0xffffff);
    markerRoot1.add(ambientLight);
}

window.addEventListener('touchstart', function onFirstTouch() {
  
    // or set some global variable
    window.USER_IS_TOUCHING = true;
  
  }, false);

  window.addEventListener('touchend', function onFirstTouch() {
  
    // or set some global variable
    window.USER_IS_TOUCHING = false;

  }, false);

function rand(min, max) {
	return parseInt(min + (Math.random() * max));
}