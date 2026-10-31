import {loadPublishedRows, groupStories, renderStory, renderNotFound, renderUnavailable, htmlResponse} from '../../story-seo-lib.mjs';

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return new Response('Method not allowed', {status:405,headers:{Allow:'GET, HEAD'}});
  const slug = context.params.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug))
    return htmlResponse(renderNotFound(), 404, method);
  try {
    const stories = groupStories(await loadPublishedRows());
    const story = stories.find(item => item.slug === slug);
    return story ? htmlResponse(renderStory(story), 200, method) : htmlResponse(renderNotFound(), 404, method);
  } catch (error) {
    console.error('Story detail public read failed:', error?.message || 'unknown');
    return htmlResponse(renderUnavailable(), 503, method);
  }
}
