import { Octokit } from '@octokit/rest'

/**
 * Publishes content to a GitHub repository file.
 * Creates the file if it doesn't exist, or updates it if it does.
 *
 * @param {Object} params
 * @param {string} params.token - GitHub personal access token
 * @param {string} params.owner - GitHub username or organization
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path in the repo (e.g. "index.html")
 * @param {string} params.content - File content (plain text)
 * @param {string} [params.message] - Commit message
 * @param {string} [params.branch] - Branch name (defaults to repo default)
 * @returns {Promise<Object>} GitHub API response data
 */
export async function publishToGitHub({ token, owner, repo, path, content, message, branch }) {
  const octokit = new Octokit({ auth: token })

  // Get current file SHA if it exists (required for updates)
  let sha
  try {
    const params = { owner, repo, path }
    if (branch) params.ref = branch
    const { data } = await octokit.repos.getContent(params)
    sha = data.sha
  } catch (err) {
    // File doesn't exist yet — that's fine, we'll create it
    if (err.status !== 404) {
      throw err
    }
  }

  const commitParams = {
    owner,
    repo,
    path,
    message: message || 'Update site via Page Builder',
    content: Buffer.from(content).toString('base64'),
  }

  if (sha) commitParams.sha = sha
  if (branch) commitParams.branch = branch

  const { data } = await octokit.repos.createOrUpdateFileContents(commitParams)
  return data
}

/**
 * Gets information about a GitHub repository.
 *
 * @param {Object} params
 * @param {string} params.token - GitHub personal access token
 * @param {string} params.owner - GitHub username or organization
 * @param {string} params.repo - Repository name
 * @returns {Promise<Object>} Repository data
 */
export async function getRepoInfo({ token, owner, repo }) {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.repos.get({ owner, repo })
  return data
}

/**
 * Lists branches in a repository.
 *
 * @param {Object} params
 * @param {string} params.token - GitHub personal access token
 * @param {string} params.owner - GitHub username or organization
 * @param {string} params.repo - Repository name
 * @returns {Promise<Array>} List of branches
 */
export async function listBranches({ token, owner, repo }) {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.repos.listBranches({ owner, repo })
  return data
}
