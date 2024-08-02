// import axios from 'axios';
// import sharp from 'sharp';

// // Function to generate a collage with two images side by side and return base64 string
// async function generateCollageBase64(ipfsHashes, submissionIDs) {
//   console.log(submissionIDs)
 

//   try {
//     // Fetch all images
//     const images = await Promise.all(ipfsHashes.map(async (hash, index) => {
//       const url = `https://gateway.catoff.xyz/ipfs/${hash}`;
//       const response = await axios.get(url, { responseType: 'arraybuffer' });

//       if (response.status !== 200) {
//         throw new Error(`HTTP error! Status: ${response.status}`);
//       }

//       const contentType = response.headers['content-type'];

//       if (contentType && contentType.startsWith("image/")) {
//         // Add submission ID as metadata
//         return {
//           buffer: Buffer.from(response.data),
//           submissionID: submissionIDs[index]
//         };
//       } else {
//         throw new Error("Fetched content is not an image.");
//       }
//     }));

//     // Create collage from images
//     const collageBuffer = await createCollage(images);

//     // Convert collage buffer to base64 string
//     const collageBase64 = collageBuffer.toString('base64');
//     const base64Image = `data:image/png;base64,${collageBase64}`;

//     return base64Image;
//   } catch (error) {
//     console.error('Error fetching images or creating collage:', error);
//     throw new Error('Failed to generate collage image');
//   }
// }
// // tion to create a collage with n images side by side
// async function createCollage(images) {
//   const collageImages = await Promise.all(images.map(async image => ({
//     buffer: await addTextToImage(image.buffer, image.submissionID),
//     metadata: await sharp(image.buffer).metadata()
//   })));

//   const totalWidth = collageImages.reduce((sum, img) => sum + img.metadata.width, 0);
//   const maxHeight = Math.max(...collageImages.map(img => img.metadata.height));

//   // Create a new image with total width and max height
//   const collage = sharp({
//     create: {
//       width: totalWidth,
//       height: maxHeight,
//       channels: 4,
//       background: { r: 255, g: 255, b: 255 }
//     }
//   });

//   // Composite images side by side with text
//   let leftOffset = 0;
//   const composites = collageImages.map(image => {
//     const { width, height } = image.metadata;
//     const composite = {
//       input: image.buffer,
//       top: 0,
//       left: leftOffset
//     };
//     leftOffset += width;
//     return composite;
//   });

//   return collage.composite(composites).png().toBuffer();
// }


// /// Function to overlay text on an image
// async function addTextToImage(imageBuffer, text) {
//   const image = sharp(imageBuffer);

//   // Add text to the image with better visibility
//   return await image
//     .composite([{
//       input: Buffer.from(`
//         <svg >
//    <!--     <text x="30" y="100" z-index="10" font-size="50" fill="black" font-family="Arial" font-weight="bold">${text}</text> -->

//           <!-- Background rectangle for better text visibility -->
//           <rect x="0" y="50" width="200px" height="120" fill="rgba(0, 0, 0, 1)" />
//           <text x="30" y="100" z-index="10" font-size="50" fill="white" font-family="Arial" font-weight="bold"> Id: ${text}</text>

//           <!-- Text styling -->
//         </svg>
//       `),
//       gravity: 'northwest'
//     }])
//     .toBuffer();
// }


// export default generateCollageBase64;
