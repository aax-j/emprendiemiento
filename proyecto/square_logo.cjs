const { Jimp } = require('jimp');

async function makeSquare() {
  const image = await Jimp.read('src/assets/logo-blue.jpg');
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const size = Math.max(width, height);
  
  // Create a new image with white background
  const square = new Jimp({ width: size, height: size, color: '#ffffff' });
  
  // Composite the original image in the center
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  square.composite(image, x, y);
  
  await square.write('src/assets/logo-square.png');
  console.log('Square image created at src/assets/logo-square.png');
}

makeSquare().catch(console.error);
