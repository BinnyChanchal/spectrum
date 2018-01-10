// @flow

export default async (_, { input }, { user }) => {
  const currentUser = user;

  // user must be authed to edit a thread
  if (!currentUser) {
    return new UserError(
      'You must be signed in to make changes to this thread.'
    );
  }

  if (input.type === 'SLATE') {
    throw new UserError(
      "You're on an old version of Spectrum, please refresh your browser."
    );
  }

  const threads = await getThreads([input.threadId]);

  // select the thread
  const threadToEvaluate = threads[0];

  // if the thread doesn't exist
  if (!threads || !threadToEvaluate) {
    return new UserError("This thread doesn't exist");
  }

  // only the thread creator can edit the thread
  if (threadToEvaluate.creatorId !== currentUser.id) {
    return new UserError(
      "You don't have permission to make changes to this thread."
    );
  }

  let attachments = [];
  // if the thread came in with attachments
  if (input.attachments) {
    // iterate through them and construct a new attachment object
    input.attachments.map(attachment => {
      attachments.push({
        attachmentType: attachment.attachmentType,
        data: JSON.parse(attachment.data),
      });
    });
  }

  const newInput = Object.assign({}, input, {
    ...input,
    content: {
      ...input.content,
      title: input.content.title.trim(),
    },
    attachments,
  });

  const editedThread = await editThread(newInput);

  if (!input.filesToUpload) return editedThread;

  const urls = await Promise.all(
    input.filesToUpload.map(file =>
      uploadImage(file, 'threads', editedThread.id)
    )
  );

  if (!urls || urls.length === 0) return editedThread;

  // Replace the local image srcs with the remote image src
  const body = JSON.parse(editedThread.content.body);
  const imageKeys = Object.keys(body.entityMap).filter(
    key => body.entityMap[key].type === 'image'
  );
  urls.forEach((url, index) => {
    if (!body.entityMap[imageKeys[index]]) return;
    body.entityMap[imageKeys[index]].data.src = url;
  });

  // Update the thread with the new links
  return editThread({
    threadId: editedThread.id,
    content: {
      ...editedThread.content,
      body: JSON.stringify(body),
    },
  });
};