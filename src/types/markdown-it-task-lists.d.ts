declare module 'markdown-it-task-lists' {
  import MarkdownIt from 'markdown-it'
  const taskLists: (parser: InstanceType<typeof MarkdownIt>) => void
  export default taskLists
}
