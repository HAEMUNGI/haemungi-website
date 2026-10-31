import {loadPublishedRows, groupStories, renderArchive, renderUnavailable, htmlResponse} from '../../story-seo-lib.mjs';

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return new Response('Method not allowed', {status:405,headers:{Allow:'GET, HEAD'}});
  try {
    const stories = groupStories(await loadPublishedRows());
    return htmlResponse(renderArchive(stories), 200, method);
  } catch (error) {
    console.error('Story archive public read failed:', error?.message || 'unknown');
    return htmlResponse(renderUnavailable(), 503, method);
  }
}
