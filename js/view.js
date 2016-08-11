

var view = ( function () {

    'use strict';

    var params = {
        background: false,
        sphere: false,
        // toneMapping
        exposure: 3.0,
        whitePoint: 5.0,
        tone: "Uncharted2",
        // bloom
        strength: 1.5,
        threshold: 0.9,
        radius: 1.0,

        pixelRatio : 1,

    }



    var channels = [];
    var isBuff = [false, false, false, false];
    var channelResolution;

    var currentScene = -1;

    var gl = null;

    var degtorad = 0.0174532925199432957;
    var radtodeg = 57.295779513082320876;

    var canvas, renderer, scene, camera, controls, light, clock;
    var vsize, mouse, time, key = new Float32Array( 20 );

    var vs = { w:1, h:1, l:0, x:0 , y:0};

    var isPostEffect = false, renderScene, effectFXAA, bloomPass, copyShader, composer = null;


    var gputmp = null;

    //var raycaster, mouse, mouseDown = false;

    var cubeCamera = null;
    var textureCubeCamera = null;
    var textureCube = null;

    var txt = {};
    var txt_name = [];
    var cube_name = [];

    var geo = {};
    var textures = {};
    var materials = {};
    var meshs = {};
    var shaders = {};

    var env;
    var envName;

    var extraUpdate = [];
    var toneMappings;

    var WIDTH = 512;


    var mesh, mesh2;
    var material = null;
    var uniforms = null;
    var tx, tx2;
    var vertex, fragment;

    view = {

        render: function () {

            requestAnimationFrame( view.render );

            var i = extraUpdate.length;
            while(i--) extraUpdate[i]();

            time.x += clock.getDelta();
            key = user.getKey();

            if(uniforms){ 
                //uniforms.time.value = time.x;
                uniforms.iGlobalTime.value = time.x;
                uniforms.iFrame.value ++;
               // uniforms.key.value = key;
                //uniforms.mouse.value = mouse;
            }
            
            if( isPostEffect ) composer.render();
            else renderer.render( scene, camera );
            
        },

        resize: function () {

            vsize.x = window.innerWidth - vs.x - vs.y;
            vsize.y = window.innerHeight;
            vsize.z = vsize.x / vsize.y;
            camera.aspect = vsize.z;
            camera.updateProjectionMatrix();
            renderer.setSize( vsize.x, vsize.y );

            canvas.style.left = vs.x +'px';

            if( currentScene === 0 ){ 
                // 1 is distance from camera
                var h = 2 * Math.tan( (camera.fov * degtorad) * 0.5 ) * 1;
                mesh.scale.set(h*vsize.z, h, 1);

            }

            editor.resizeMenu( vsize.x );

            if( isPostEffect ){
                composer.setSize( vsize.x, vsize.y );
                effectFXAA.uniforms['resolution'].value.set(1 / vsize.x, 1 / vsize.y );
            }

        },

        reset: function ( ) {

            //console.clear();
            time.x = 0;
        },

       

        init: function () {

            /*toneMappings = {
                None: THREE.NoToneMapping,
                Linear: THREE.LinearToneMapping,
                Reinhard: THREE.ReinhardToneMapping,
                Uncharted2: THREE.Uncharted2ToneMapping,
                Cineon: THREE.CineonToneMapping
            };*/

            channelResolution = [
                new THREE.Vector2(),
                new THREE.Vector2(),
                new THREE.Vector2(),
                new THREE.Vector2()
            ];

            canvas = document.createElement("canvas");
            canvas.className = 'canvas3d';
            canvas.oncontextmenu = function(e){ e.preventDefault(); };
            canvas.ondrop = function(e) { e.preventDefault(); };
            document.body.appendChild( canvas );

            var isWebGL2 = false;

            // Try creating a WebGL 2 context first
             gl = canvas.getContext( 'webgl2', { antialias: false, alpha:false, stencil:false, depth:false } );
             if (!gl) {
                gl = canvas.getContext( 'experimental-webgl2', { antialias: false, alpha:false, stencil:false, depth:false  } );
            }
            isWebGL2 = !!gl;

            console.log('Webgl 2 is ' + isWebGL2 );

            //gl.getExtension("OES_standard_derivatives");

            time = new THREE.Vector2();
            clock = new THREE.Clock();

            //container = document.createElement( 'div' );
            //document.body.appendChild( container );

            vsize = new THREE.Vector3( window.innerWidth, window.innerHeight, 0);
            vsize.z = vsize.x / vsize.y;

            mouse = new THREE.Vector4();

            renderer = new THREE.WebGLRenderer({ canvas:canvas, context:gl, antialias:false, alpha:false });
            //renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setPixelRatio( params.pixelRatio );
            renderer.setSize( vsize.x, vsize.y );
            renderer.setClearColor( 0x252525, 1 );


            //gl = renderer.getContext();

            //canvas.addEventListener("webglcontextlost", function(event) {
                //event.preventDefault();
            //    editor.setTitle('Error');
            //}, false);

            renderer.gammaInput = true;
            renderer.gammaOutput = true;

            //

            //container.appendChild( renderer.domElement );

            scene = new THREE.Scene();
            scene.matrixAutoUpdate = false;

            camera = new THREE.PerspectiveCamera( 50, vsize.z, 0.1, 1000 );
            camera.position.set(0,0,10);
            scene.add(camera)

            controls = new THREE.OrbitControls( camera, canvas );
            controls.target.set(0,0,0);
            controls.enableKeys = false;
            controls.update();


            window.addEventListener( 'resize', view.resize, false ); 
           // window.addEventListener( 'error', function(e, url, line){  editor.setTitle('Error'); }, false );

            //window.onerror = function(e, url, line){  editor.setTitle('Error'); };

            renderer.domElement.addEventListener( 'mousemove', view.move, false );
            renderer.domElement.addEventListener( 'mousedown', view.down, false );
            renderer.domElement.addEventListener( 'mouseup', view.up, false );  


            gputmp = new view.GpuSide( renderer );

            //this.setTone();
            this.render();
            
        },

        setTone : function(v) {

            //if(v!==undefined) params.tone = v;

            //renderer.toneMapping = toneMappings[ params.tone ];
            //renderer.toneMappingExposure = params.exposure;
            //renderer.toneMappingWhitePoint = params.whitePoint;

            uniforms.exposure.value = params.exposure;
            uniforms.whitePoint.value = params.whitePoint;

        },

        setQuality: function ( v ) {

            params.pixelRatio = v;
            renderer.setPixelRatio( params.pixelRatio );

        },

        //

        move: function ( e ) {
            mouse.x = e.clientX - vs.x;//( e.clientX / vsize.x ) * 2 - 1;
            mouse.y =  vsize.y-e.clientY;//- ( e.clientY / vsize.y ) * 2 + 1;
        },

        down: function () {
            mouse.z = 1;
        },

        up: function () {
            mouse.z = 0;
        },

        //

        setLeft: function ( x, y ) { 
            vs.x = x; 
            vs.y = y;
        },

        needFocus: function () {
            canvas.addEventListener('mouseover', editor.unFocus, false );
        },

        haveFocus: function () {
            canvas.removeEventListener('mouseover', editor.unFocus, false );
        },

        

        initLights: function ( shadow ) {

            //scene.add( new THREE.AmbientLight( 0x404040 ) );

            var pointLight = new THREE.PointLight( 0xFFFFFF, 0.25, 600);
            pointLight.position.set( -5,-10,-10 ).multiplyScalar( 10 );
            scene.add( pointLight );

            var pointLight2 = new THREE.PointLight( 0xFFFFFF, 0.25, 600);
            pointLight2.position.set( 5,-10,-10 ).multiplyScalar( 10 );
            scene.add( pointLight2 );

            
            light = new THREE.SpotLight( 0xFFFFFF, 0.5, 600 );
            light.position.set(-3,10,10).multiplyScalar( 10 );
            light.lookAt(new THREE.Vector3(0,0,0));

            //

            if( shadow ){
                light.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( 20, 1, 5, 200 ) );
                light.shadow.bias = 0.0001;
                light.shadow.mapSize.width = 1024;
                light.shadow.mapSize.height = 1024;
                light.castShadow = true;

                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFShadowMap;
            }

            //

            scene.add( light );

            var light2 = new THREE.SpotLight( 0xFFFFFF, 0.25, 600 );
            light2.position.set(3,-5,10).multiplyScalar( 10 );
            light2.lookAt(new THREE.Vector3(0,0,0));

            scene.add( light2 );

        },

        initPostEffect: function () {

            renderScene = new THREE.RenderPass( scene, camera );
            //renderScene.clearAlpha = true;

            // renderScene.clear = true;
            effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
            effectFXAA.uniforms['resolution'].value.set( 1 / vsize.x, 1 / vsize.y );

            copyShader = new THREE.ShaderPass( THREE.CopyShader );

            bloomPass = new THREE.UnrealBloomPass( new THREE.Vector2( vsize.x, vsize.y ), params.strength, params.radius, params.threshold);

            composer = new THREE.EffectComposer( renderer );
            composer.setSize( vsize.x, vsize.y );

            composer.addPass(renderScene);
            composer.addPass(effectFXAA);
            composer.addPass(bloomPass);
            composer.addPass(copyShader);

            copyShader.renderToScreen = true;
            isPostEffect = true;

        },

        setBloom: function(){

            bloomPass.threshold = params.threshold;
            bloomPass.strength = params.strength;
            bloomPass.radius = params.radius;

        },

        initCubeCamera: function () {

            cubeCamera = new THREE.CubeCamera( 0.1, 1000, 512 );
            scene.add( cubeCamera );

            textureCubeCamera = cubeCamera.renderTarget.texture;

        },

        getCubeEnvMap: function () {

            return cubeCamera.renderTarget.texture;

        },

        // -----------------------
        //  RING SIDE
        // -----------------------

        loadAssets : function ( EnvName ) {

            envName = envName || 'grey1'

            cube_name = [ 'grey1' ];

            txt_name = [ 'noise', 'stone', 'bump', 'tex06', 'tex18', 'tex07', 'tex03', 'tex09', 'tex00', 'tex08', 'tex01', 'tex05', 'tex02', 'tex12', 'tex10' ];

            pool.load( ['glsl/basic_vs.glsl', 'glsl/basic_fs.glsl', 'textures/basic.png'], view.initModel );

        },

        loadAssetsPlus : function ( EnvName ) {

            var urls = [];
            
            var i = txt_name.length;
            while(i--) urls.push('textures/'+txt_name[i]+'.png');

            //envName = envName || 'grey1';
            urls.push('textures/cube/'+envName+'.cube');

            pool.load( urls, view.endLoading );

        },

        endLoading: function() {

            var p = pool.getResult();

            // init textures

            var i = txt_name.length, tx, j, name;
            while(i--){
                name = txt_name[i];
                tx = new THREE.Texture( p[name] );
                tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
                if(name === 'noise' || name === 'tex10'|| name === 'tex12') tx.flipY = false;
                else tx.flipY = true;
                tx.needsUpdate = true;
                txt[name] = tx;

                // apply after first load
                j = 4;
                while(j--){
                    if( channels[j] === name ){ 
                        uniforms['iChannel'+j].value = tx;
                        channelResolution[j].x = tx.image.width; 
                        channelResolution[j].y = tx.image.height;
                    }
                }
            }

            // init envmap
            txt[envName] = p[envName];
            textureCube = p[envName];

            j = 4;
                while(j--){
                if( channels[j] === envName ) uniforms['iChannel'+j].value = txt[envName];
            }


        },


        ///////////////////

        createShaderMaterial : function ( frag, Uni ) {

            var uni = Uni || {};

            var m = new THREE.ShaderMaterial( {
                uniforms: uni,
                vertexShader: [ 'void main(){', 'gl_Position = vec4( position, 1.0 );', '}'].join('\n'),
                fragmentShader: frag
            } );

            return m;

        },

        createRenderTarget : function ( w, h ) {

            return new THREE.WebGLRenderTarget( w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.FloatType, stencilBuffer: false });

        },

        createRenderTexture : function ( w, h ) {

            var a = new Float32Array( w * h * 4 );
            var texture = new THREE.DataTexture( a, w, h, THREE.RGBAFormat, THREE.FloatType );
            texture.needsUpdate = true;
            return texture;

        },

        load : function ( url ) {

            var xhr = new XMLHttpRequest();
            xhr.overrideMimeType('text/plain; charset=x-user-defined'); 
            xhr.open('GET', url, true);

            xhr.onload = function(){ 

                //code.setValue( xhr.responseText ); 

            }
            
            xhr.send();

        },


        ///////////////////



        setMat : function( Fragment ) {

            // reset old

            material.dispose();

            var Uni = ['precision highp float;'];

            isBuff = [ false, false, false, false ];

            var i = 4, pre, type, name, n, s, f;
            while(i--){

                pre = Fragment.search( i + '_#' );
                name = pre !== -1 ? Fragment.substring( pre + 4, Fragment.lastIndexOf( '#_' + i ) - 1 ) : null;
                type = cube_name.indexOf( name ) !== -1 ? 'samplerCube' : 'sampler2D';

                if(name !== null){
                    if(name.substring(0,6) === 'buffer'){ 
                        var s, n;
                        if( ! isNaN(name.substring(6,10)) ) n = 10;
                        else if( ! isNaN(name.substring(6,9)) ) n = 9;
                        else if( ! isNaN(name.substring(6,8)) ) n = 8;
                        isBuff[i] = true;
                        s = name.substring(6,n);
                        f = name.substring(n+1);

                        console.log(s, f);
                    }
                    
                }
                

                Uni.push( 'uniform '+ type +' iChannel' + i + ';' );

                if( txt[ name ] ){ 
                    uniforms['iChannel' + i].value = txt[ name ];
                    if( type !== 'samplerCube' ) {
                        channelResolution[i].x = txt[ name ].image.width; 
                        channelResolution[i].y = txt[ name ].image.height;
                    }
                }

                channels[i] = name; 

            }

            Uni.push(

                'uniform vec4 iMouse;',
                'uniform int iFrame;',
                'uniform vec3 iResolution;',
                'uniform float iGlobalTime;',
                'uniform vec2 iChannelResolution[4];',

                'varying vec2 vUv;',
                'varying vec3 vEye;'

            );

            Uni.push(
                '#define saturate(a) clamp( a, 0.0, 1.0 )',
                'uniform float exposure;',
                'uniform float whitePoint;',

                '#define Uncharted2Helper( x ) max( ( ( x * ( 0.15 * x + 0.10 * 0.50 ) + 0.20 * 0.02 ) / ( x * ( 0.15 * x + 0.50 ) + 0.20 * 0.30 ) ) - 0.02 / 0.30, vec3( 0.0 ) )',
                'vec3 toneMap( vec3 color ) {',
                '    color *= exposure;',
                '    return saturate( Uncharted2Helper( color ) / Uncharted2Helper( vec3( whitePoint ) ) );',
                '}'
            );

            uniforms.iGlobalTime.value = 0;
            uniforms.iFrame.value =0;

            fragment = Uni.join('\n') + Fragment;

            view.validate( fragment );

            //

            /*material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertex,
                fragmentShader: fragment,
                transparent:true,
            }); 


            //view.validate( fragment );




            var derive = Fragment.search("#extension GL_OES_standard_derivatives");
            material.extensions.derivatives = derive !== -1 ? true : false;

            mesh.material = material;
            editor.setTitle();*/

        },

        applyMaterial : function () {

            material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertex,
                fragmentShader: fragment,
                transparent:true,
            });

            //console.log(material.fragmentShader)

            mesh.material = material;
            editor.setTitle();

        },

        validate : function ( value ) {

            var details, error, i, line, lines, log, message, shader, status, _i, _len;
            var data = [];//{lineNumber:0, message:''};

            try {
                shader = gl.createShader( gl.FRAGMENT_SHADER );
                gl.shaderSource( shader, value );
                gl.compileShader(shader);
                status = gl.getShaderParameter( shader, gl.COMPILE_STATUS );
                if (!status) {
                    console.log( gl.getShaderInfoLog(shader) );
                }
                //console.log('yooo::' + status )
            } catch (e) {
                //console.log('!!!!:' + e.getMessage );
                data.push( {lineNumber:0, message:e.getMessage } );
              // return [false, 0, e.getMessage];
            } 

            if (status === true) {
                gl.deleteShader( shader );
                view.applyMaterial();

            }else{

                log = gl.getShaderInfoLog( shader );
                gl.deleteShader( shader );
                lines = log.split('\n');
                for (_i = 0, _len = lines.length; _i < _len; _i++) {
                    i = lines[_i];
                    if (i.substr(0, 5) === 'ERROR') { error = i; }
                }
                if (!error) {
                    data.push( {lineNumber:0, message:'Unable to parse error.'} );
                    //editor.showError( [false, 0, 'Unable to parse error.'] );
                }
                details = error.split(':');
                if ( details.length < 4 ) {
                    data.push( {lineNumber:0, message:error} );
                    //editor.showError( [false, 0, error] );
                }
                line = details[2];
                message = details.splice(3).join(':');
                data.push( {lineNumber:parseInt(line)-11, message:message } );

                editor.setTitle('/!&#92; ERROR');
            }

            editor.validate( data );
        },

        initModel : function () {

            var p = pool.getResult();
        
            // init empty textures

            var i = txt_name.length, tx;
            while(i--){
                tx = new THREE.Texture( p['basic'] );
                tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
                if(name === 'noise' || name === 'tex10'|| name === 'tex12') tx.flipY = false;
                else tx.flipY = true;
                tx.needsUpdate = true;
                txt[txt_name[i]] = tx;
            }

            txt['basic'] = tx;

            // init empty cube textures

            var imgs = [];
            i=6;
            while(i--) imgs.push(p['basic']);
            txt[envName] = new THREE.CubeTexture( imgs );


           

            // init basic shader

            vertex = p['basic_vs'];
            fragment = p['basic_fs'];

            uniforms = {

                iChannel0: { type: 't', value: null },
                iChannel1: { type: 't', value: null },
                iChannel2: { type: 't', value: null },
                iChannel3: { type: 't', value: null },

                iChannelResolution: { type: 'v2v', value: channelResolution },

                iGlobalTime: { type: 'f', value: time.x },
                iResolution: { type: 'v3', value: vsize },
                iFrame: { type: 'i', value: 0 },
                iMouse: { type: 'v4', value: mouse },

                exposure: { type: 'f', value: params.exposure },
                whitePoint: { type: 'f', value: params.whitePoint },

                //
                key: { type:'fv', value:key },
                 
            };

            material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertex,
                fragmentShader: fragment,
                transparent:true,
            }); 

            /*var g2 = new THREE.SphereBufferGeometry(3, 30, 26, 30*degtorad, 120*degtorad, 45*degtorad, 90*degtorad );
            mesh2 = new THREE.Mesh( g2, material);
            scene.add( mesh2 );



            var geom = new THREE.PlaneBufferGeometry( 1, 1, 1, 1 );
            mesh = new THREE.Mesh( geom, material );
 
            var mh = 2 * Math.tan( (camera.fov * degtorad) * 0.5 ) * 1;
            mesh.scale.set(mh*vsize.z, mh, 1);
            mesh.position.set(0,0,-1);

            camera.add( mesh );*/

            view.setScene(0);

            ready();

            view.loadAssetsPlus();

        },

        setScene : function( n ){

            var g;

            if(mesh !== null){
                if(currentScene === 0 ) camera.remove( mesh );
                else scene.remove( mesh );
            }

            if( n === 0 ){

                g = new THREE.PlaneBufferGeometry( 1, 1, 1, 1 );
                mesh = new THREE.Mesh( g, material );
     
                var mh = 2 * Math.tan( (camera.fov * degtorad) * 0.5 ) * 1;
                mesh.scale.set(mh*vsize.z, mh, 1);
                mesh.position.set(0,0,-1);

                camera.add( mesh );

            }

            if( n === 1 ){

                g = new THREE.SphereBufferGeometry(3, 30, 26, 30*degtorad, 120*degtorad, 45*degtorad, 90*degtorad );
                mesh = new THREE.Mesh( g, material );
                scene.add( mesh );

            }

            if( n === 2 ){

                g = new THREE.TorusBufferGeometry( 3, 1, 50, 20 );
                mesh = new THREE.Mesh( g, material );
                scene.add( mesh );

            }

            currentScene = n;

        },

        setBackground: function(){

            if( params.background ) scene.background = textureCube;
            else scene.background = null;

        },


        // -----------------------
        //  GET FUNCTION
        // -----------------------

        getContext: function () { return gl; },

        getParams: function () { return params; },

        getPixel: function ( texture, x, y, w, h ) { 

            w = w || 1;
            h = h || 1;
            var read = new Float32Array( 4 * (w * h) );
            renderer.readRenderTargetPixels( texture, x || 0, y || 0, w, h, read ); 
            return read;
            
        },

        getBgColor: function(){ return renderer.getClearColor(); },

        getRenderer: function(){ return renderer; },

        getDom: function () { return renderer.domElement; },

        getCamera: function () { return camera; },

        getScene: function () { return scene; },

        getControls: function () { return controls; },

        // -----------------------
        //  BASIC FUNCTION
        // -----------------------

        add: function ( mesh ) { scene.add( mesh ); },
        remove: function ( mesh ) { scene.remove( mesh ); },

        moveCamera: function( c, t ){
            camera.position.fromArray( c );
            controls.target.fromArray( t );
            controls.update();
        },

        moveTarget: function( v ){
            var offset = camera.position.clone().sub( controls.target );
           // controls.autoRotate = true
            var offset = controls.target.clone().sub( camera.position );//camera.position.clone().sub( controls.target );
           // camera.position.add(v.clone().add(offset));
            controls.target.copy( v );
            //camera.position.copy( v.add(dif));
            controls.update();
        },

        setCubeEnv: function( imgs ){

            env = new THREE.CubeTexture( imgs );
            env.format = THREE.RGBFormat;
            //env.mapping = THREE.SphericalReflectionMapping;
            env.needsUpdate = true;

            return env;

        },

        setEnv: function( img ){

            env = new THREE.Texture( img );
            env.mapping = THREE.SphericalReflectionMapping;
            env.needsUpdate = true;

            return env;

        },

        getEnv: function(){

            return env; 

        },

        initGeometry: function(){

            geo = {};

            geo[ 'box' ] =  new THREE.BoxBufferGeometry( 1, 1, 1 );
            geo[ 'sphere' ] = new THREE.SphereBufferGeometry( 1, 12, 10 );
            geo[ 'cylinder' ] =  new THREE.CylinderBufferGeometry( 1, 1, 1, 12, 1 );
            //geo[ 'capsule' ] =  new THREE.CapsuleBufferGeometry( 1, 1, 12, 1 );

        },

        

        addUpdate: function ( fun ) {

            extraUpdate.push( fun );

        },

     

       

        // MATH

        toRad: function ( r ) {

            var i = r.length;
            while(i--) r[i] *= degtorad;
            return r;

        },

        lerp: function ( a, b, percent ) { return a + (b - a) * percent; },
        randRange: function ( min, max ) { return view.lerp( min, max, Math.random()); },
        randRangeInt: function ( min, max, n ) { return view.lerp( min, max, Math.random()).toFixed(n || 0)*1; },

    }

    ///

    view.GpuSide = function( renderer ){

        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.camera.position.z = 1;
        this.mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ) );
        this.scene.add( this.mesh );

    };

    view.GpuSide.prototype = {
        render: function( material, output ){
            mesh.material = material;
            this.renderer.render( this.scene, this.camera, output, false )
        }
    }

    return view;

})();



