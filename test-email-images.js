// Test the email template with images
const testImages = [
    {
        url: "https://example.com/image1.jpg",
        alt: "Test Image 1"
    },
    {
        url: "https://example.com/image2.jpg",
        alt: "Test Image 2"
    }
];

const testSubject = "Test Email with Images";
const testContent = "This is a test email with images. [IMAGE] Here's some content after the image.";

console.log("Testing email template with images...");
console.log("Subject:", testSubject);
console.log("Content:", testContent);
console.log("Images:", testImages);

// Simple test of the image processing logic
const imageHtml = testImages.length > 0 ?
    testImages.map(img => {
        const imgUrl = typeof img === 'string' ? img : img.url;
        const imgAlt = typeof img === 'string' ? 'MS Foods' : (img.alt || 'MS Foods');
        return `<img src="${imgUrl}" alt="${imgAlt}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;">`;
    }).join('') : '';

console.log("\nGenerated image HTML:");
console.log(imageHtml);

// Process content to handle [IMAGE] placeholders
let processedContent = testContent;
if (testImages.length > 0 && testContent.includes('[IMAGE]')) {
    // Replace [IMAGE] placeholders with images
    processedContent = testContent.replace(/\[IMAGE\]/g, imageHtml);
    console.log("\n📍 Replaced [IMAGE] placeholders");
} else if (testImages.length > 0) {
    // If no [IMAGE] placeholder, append images at the end
    processedContent = testContent + imageHtml;
    console.log("\n📎 Appended images to end");
}

console.log("\nFinal processed content:");
console.log(processedContent);

// Check if images are included
const hasImages = processedContent.includes('<img');
console.log("\nContains images:", hasImages);

// Count img tags
const imgTagCount = (processedContent.match(/<img/g) || []).length;
console.log("Number of img tags:", imgTagCount);

// Check if [IMAGE] placeholder was replaced
const hasPlaceholder = processedContent.includes('[IMAGE]');
console.log("Still contains [IMAGE] placeholder:", hasPlaceholder); 